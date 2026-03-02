/**
 * Next.js Middleware - Security Hardening
 * 
 * OWASP Best Practices Implementation:
 * - Rate limiting on all endpoints
 * - Security headers (CSP, X-Frame-Options, etc.)
 * - Request validation
 * - Origin checking
 * - Logging and monitoring
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Security utilities
import {
  SECURITY_HEADERS,
  buildCSPHeader,
  logSecurityEvent,
  isTrustedOrigin,
} from './lib/security'

// Rate limiting storage (in-memory for middleware)
// Note: For production, use Redis or similar distributed cache
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Simple rate limiter for middleware
 * Limits: 100 requests per minute per IP
 */
function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 100;

  const entry = rateLimitStore.get(ip);

  // Clean up expired entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }

  // No previous requests or window expired
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  // Within rate limit
  if (entry.count < maxRequests) {
    entry.count++;
    rateLimitStore.set(ip, entry);
    return { allowed: true, remaining: maxRequests - entry.count };
  }

  // Rate limit exceeded
  return { allowed: false, remaining: 0 };
}

/**
 * Get client IP from request
 */
function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return 'unknown';
}

export function middleware(request: NextRequest) {
  const startTime = Date.now();
  
  // Get client IP
  const clientIp = getClientIp(request);
  
  // Check rate limit
  const rateLimit = checkRateLimit(clientIp);
  
  if (!rateLimit.allowed) {
    // Log rate limit violation
    logSecurityEvent('rate_limit_exceeded', {
      ip: clientIp,
      path: request.nextUrl.pathname,
      method: request.method,
    });

    // Return 429 Too Many Requests
    return new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '60',
          ...SECURITY_HEADERS,
        },
      }
    );
  }

  // Check origin for non-GET requests
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('origin');
    if (origin && !isTrustedOrigin(origin)) {
      logSecurityEvent('untrusted_origin', {
        ip: clientIp,
        origin,
        path: request.nextUrl.pathname,
      });

      return new NextResponse(
        JSON.stringify({
          error: 'Forbidden',
          message: 'Request from untrusted origin',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            ...SECURITY_HEADERS,
          },
        }
      );
    }
  }

  // Create response
  const response = NextResponse.next();

  // Set security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Set Content Security Policy
  response.headers.set('Content-Security-Policy', buildCSPHeader());

  // Set rate limit headers
  response.headers.set('X-RateLimit-Limit', '100');
  response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());

  // Set request ID for tracking
  const requestId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  response.headers.set('X-Request-ID', requestId);

  // Log request (in development only)
  if (process.env.NODE_ENV === 'development') {
    const duration = Date.now() - startTime;
    console.log(`[${request.method}] ${request.nextUrl.pathname} - ${duration}ms - IP: ${clientIp}`);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
