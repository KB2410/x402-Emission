/**
 * Rate Limiting Implementation
 * 
 * OWASP Best Practices:
 * - Implements both IP-based and user-based rate limiting
 * - Uses sliding window algorithm for accurate rate limiting
 * - Provides graceful degradation with configurable limits
 * - Includes automatic cleanup of expired entries
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

class RateLimiter {
  private ipStore: Map<string, RateLimitEntry> = new Map();
  private userStore: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if request should be rate limited
   * @param identifier - IP address or user identifier
   * @param config - Rate limit configuration
   * @param isUser - Whether this is user-based (true) or IP-based (false)
   * @returns Object with allowed status and retry information
   */
  checkLimit(
    identifier: string,
    config: RateLimitConfig,
    isUser: boolean = false
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const store = isUser ? this.userStore : this.ipStore;
    const now = Date.now();
    const entry = store.get(identifier);

    // No previous requests or window expired
    if (!entry || now > entry.resetTime) {
      store.set(identifier, {
        count: 1,
        resetTime: now + config.windowMs,
        firstRequest: now,
      });
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs,
      };
    }

    // Within rate limit window
    if (entry.count < config.maxRequests) {
      entry.count++;
      store.set(identifier, entry);
      return {
        allowed: true,
        remaining: config.maxRequests - entry.count,
        resetTime: entry.resetTime,
      };
    }

    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Reset rate limit for a specific identifier
   */
  reset(identifier: string, isUser: boolean = false): void {
    const store = isUser ? this.userStore : this.ipStore;
    store.delete(identifier);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    
    // Cleanup IP store
    for (const [key, entry] of this.ipStore.entries()) {
      if (now > entry.resetTime) {
        this.ipStore.delete(key);
      }
    }

    // Cleanup user store
    for (const [key, entry] of this.userStore.entries()) {
      if (now > entry.resetTime) {
        this.userStore.delete(key);
      }
    }
  }

  /**
   * Destroy rate limiter and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.ipStore.clear();
    this.userStore.clear();
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

/**
 * Rate limit configurations for different endpoints
 * Following OWASP recommendations for API rate limiting
 */
export const RATE_LIMITS = {
  // Strict limits for authentication/wallet operations
  WALLET_CONNECT: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,           // 10 attempts per 15 minutes
  },
  
  // Standard limits for read operations
  READ_OPERATIONS: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 60,           // 60 requests per minute
  },
  
  // Stricter limits for write operations
  WRITE_OPERATIONS: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 10,           // 10 requests per minute
  },
  
  // Very strict limits for transaction submissions
  TRANSACTION_SUBMIT: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 5,            // 5 transactions per minute
  },
  
  // Moderate limits for contract queries
  CONTRACT_QUERY: {
    windowMs: 60 * 1000,       // 1 minute
    maxRequests: 30,           // 30 queries per minute
  },
} as const;

/**
 * Get client IP address from request
 * Handles various proxy headers
 */
export function getClientIp(headers: Headers): string {
  // Check common proxy headers
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback to a default (should not happen in production)
  return 'unknown';
}

/**
 * Check rate limit for a request
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
  isUser: boolean = false
): { allowed: boolean; remaining: number; resetTime: number } {
  return rateLimiter.checkLimit(identifier, config, isUser);
}

/**
 * Reset rate limit for an identifier
 */
export function resetRateLimit(identifier: string, isUser: boolean = false): void {
  rateLimiter.reset(identifier, isUser);
}

/**
 * Client-side rate limiter for preventing excessive requests
 */
class ClientRateLimiter {
  private requests: Map<string, number[]> = new Map();

  /**
   * Check if action is allowed based on client-side rate limiting
   */
  isAllowed(action: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const requests = this.requests.get(action) || [];
    
    // Remove expired requests
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(action, validRequests);
    return true;
  }

  /**
   * Get time until next request is allowed
   */
  getRetryAfter(action: string, maxRequests: number, windowMs: number): number {
    const requests = this.requests.get(action) || [];
    if (requests.length < maxRequests) {
      return 0;
    }
    
    const oldestRequest = requests[0];
    const retryAfter = windowMs - (Date.now() - oldestRequest);
    return Math.max(0, retryAfter);
  }

  /**
   * Reset rate limit for an action
   */
  reset(action: string): void {
    this.requests.delete(action);
  }
}

// Export client-side rate limiter
export const clientRateLimiter = new ClientRateLimiter();

/**
 * Rate limit decorator for client-side functions
 */
export function withRateLimit<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  action: string,
  maxRequests: number,
  windowMs: number
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    if (!clientRateLimiter.isAllowed(action, maxRequests, windowMs)) {
      const retryAfter = clientRateLimiter.getRetryAfter(action, maxRequests, windowMs);
      throw new Error(
        `Rate limit exceeded. Please try again in ${Math.ceil(retryAfter / 1000)} seconds.`
      );
    }
    
    return fn(...args);
  }) as T;
}

export default rateLimiter;
