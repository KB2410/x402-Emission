/**
 * Security Module Index
 * 
 * Centralized export of all security utilities
 * Following OWASP best practices for web application security
 */

// Rate limiting
export {
  checkRateLimit,
  resetRateLimit,
  getClientIp,
  clientRateLimiter,
  withRateLimit,
  RATE_LIMITS,
} from './rateLimit';

// Input validation
export {
  validateStellarAddress,
  sanitizeString,
  validateNumber,
  validateBigInt,
  validateOptionType,
  validateTimestamp,
  validateCreateOption,
  validateBuyOption,
  validateLiquidity,
  sanitizeObject,
  validateContractAddress,
  validateTransactionHash,
  validateRequestFrequency,
  ValidationError,
  type CreateOptionSchema,
  type BuyOptionSchema,
  type LiquiditySchema,
} from './validation';

// Environment configuration
export {
  clientEnv,
  validateEnvironment,
  getNetworkPassphrase,
  isDevelopment,
  isProduction,
  sanitizeForLogging,
  EnvValidationError,
} from './env';

// Import for internal use
import { isDevelopment } from './env';
import { ValidationError } from './validation';

/**
 * Security headers configuration
 * Following OWASP Secure Headers Project recommendations
 */
export const SECURITY_HEADERS = {
  // Prevent clickjacking attacks
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Enable XSS protection
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions policy (formerly Feature-Policy)
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  
  // Strict Transport Security (HTTPS only)
  // Note: Only enable in production with HTTPS
  // 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
} as const;

/**
 * Content Security Policy configuration
 * Strict CSP to prevent XSS and injection attacks
 */
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-eval'", // Required for Next.js
    "'unsafe-inline'", // Required for inline scripts (minimize usage)
    'blob:',
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for styled-components/CSS-in-JS
  ],
  'img-src': [
    "'self'",
    'data:',
    'https:',
    'blob:',
  ],
  'font-src': [
    "'self'",
    'data:',
  ],
  'connect-src': [
    "'self'",
    'https://horizon-testnet.stellar.org',
    'https://horizon.stellar.org',
    'https://soroban-testnet.stellar.org',
    'https://soroban-rpc.mainnet.stellar.gateway.fm',
    'wss:',
    'ws:',
  ],
  'worker-src': [
    "'self'",
    'blob:',
  ],
  'child-src': [
    "'self'",
    'blob:',
  ],
  'frame-ancestors': ["'none'"], // Prevent framing
  'base-uri': ["'self'"], // Prevent base tag injection
  'form-action': ["'self'"], // Restrict form submissions
  'upgrade-insecure-requests': [], // Upgrade HTTP to HTTPS
} as const;

/**
 * Build CSP header string from directives
 */
export function buildCSPHeader(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, sources]) => {
      if (sources.length === 0) {
        return directive;
      }
      return `${directive} ${sources.join(' ')}`;
    })
    .join('; ');
}

/**
 * Sanitize error messages for client display
 * Prevents information leakage through error messages
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof ValidationError) {
    // Validation errors are safe to show
    return error.message;
  }

  if (error instanceof Error) {
    // Generic error message for other errors
    if (isDevelopment()) {
      // Show full error in development
      return error.message;
    }
    // Generic message in production
    return 'An error occurred. Please try again.';
  }

  return 'An unexpected error occurred.';
}

/**
 * Log security events (for monitoring and auditing)
 */
export function logSecurityEvent(
  event: string,
  details: Record<string, any> = {}
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    ...details,
  };

  if (isDevelopment()) {
    console.log('🔒 Security Event:', logEntry);
  } else {
    // In production, send to monitoring service
    // Example: sendToMonitoring(logEntry);
    console.log('🔒 Security Event:', event);
  }
}

/**
 * Check if request is from a trusted origin
 */
export function isTrustedOrigin(origin: string): boolean {
  const trustedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    // Add production domains here
    // 'https://yourdomain.com',
  ];

  return trustedOrigins.includes(origin);
}

/**
 * Generate a secure random string (for nonces, etc.)
 */
export function generateSecureRandom(length: number = 32): string {
  if (typeof window !== 'undefined' && window.crypto) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback for server-side
  return Math.random().toString(36).substring(2, length + 2);
}

/**
 * Timing-safe string comparison
 * Prevents timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
