/**
 * Secure Stellar SDK Wrapper
 * 
 * This file wraps all Stellar SDK operations with security enhancements:
 * - Input validation
 * - Rate limiting
 * - Error sanitization
 * - Logging
 * 
 * OWASP Best Practices Applied:
 * - Validate all inputs before blockchain operations
 * - Rate limit transaction submissions
 * - Sanitize error messages
 * - Log security events
 */

import {
  validateBuyOption,
  validateCreateOption,
  validateLiquidity,
  validateStellarAddress,
  ValidationError,
  clientRateLimiter,
  RATE_LIMITS,
  sanitizeErrorMessage,
  logSecurityEvent,
  clientEnv,
} from './security';

import * as stellar from './stellar';

/**
 * Secure wrapper for buyOption
 * Adds validation and rate limiting
 */
export async function buyOptionSecure(
  optionId: number,
  userPublicKey: string
): Promise<string> {
  try {
    // Validate inputs
    const validated = validateBuyOption({ optionId, buyer: userPublicKey });

    // Check rate limit (5 transactions per minute)
    if (!clientRateLimiter.isAllowed('buy_option', 5, 60 * 1000)) {
      const retryAfter = clientRateLimiter.getRetryAfter('buy_option', 5, 60 * 1000);
      throw new ValidationError(
        `Rate limit exceeded. Please wait ${Math.ceil(retryAfter / 1000)} seconds before buying another option.`
      );
    }

    // Log transaction attempt
    logSecurityEvent('buy_option_attempt', {
      optionId: validated.optionId,
      buyer: validated.buyer.substring(0, 8) + '...',
    });

    // Call original function
    const result = await stellar.buyOption(validated.optionId, validated.buyer);

    // Log success
    logSecurityEvent('buy_option_success', {
      optionId: validated.optionId,
      txHash: result.substring(0, 16) + '...',
    });

    return result;
  } catch (error) {
    // Log error
    logSecurityEvent('buy_option_error', {
      optionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Sanitize and re-throw
    throw new Error(sanitizeErrorMessage(error));
  }
}

/**
 * Secure wrapper for writeOption
 * Adds validation and rate limiting
 */
export async function writeOptionSecure(
  optionType: 'Call' | 'Put',
  strikePrice: bigint,
  expiration: number,
  emissionPeriodStart: number,
  emissionPeriodEnd: number,
  underlyingAmount: bigint,
  premium: bigint,
  collateralAmount: bigint,
  userPublicKey: string
): Promise<string> {
  try {
    // Validate inputs
    const validated = validateCreateOption({
      optionType,
      strikePrice,
      expiration,
      emissionPeriodStart,
      emissionPeriodEnd,
      underlyingAmount,
      premium,
      collateralAmount,
      writer: userPublicKey,
    });

    // Check rate limit (3 option creations per minute)
    if (!clientRateLimiter.isAllowed('write_option', 3, 60 * 1000)) {
      const retryAfter = clientRateLimiter.getRetryAfter('write_option', 3, 60 * 1000);
      throw new ValidationError(
        `Rate limit exceeded. Please wait ${Math.ceil(retryAfter / 1000)} seconds before creating another option.`
      );
    }

    // Log transaction attempt
    logSecurityEvent('write_option_attempt', {
      optionType: validated.optionType,
      writer: validated.writer.substring(0, 8) + '...',
    });

    // Call original function
    const result = await stellar.writeOption(
      validated.optionType,
      validated.strikePrice,
      validated.expiration,
      validated.emissionPeriodStart,
      validated.emissionPeriodEnd,
      validated.underlyingAmount,
      validated.premium,
      validated.collateralAmount,
      validated.writer
    );

    // Log success
    logSecurityEvent('write_option_success', {
      optionType: validated.optionType,
      txHash: result.substring(0, 16) + '...',
    });

    return result;
  } catch (error) {
    // Log error
    logSecurityEvent('write_option_error', {
      optionType,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Sanitize and re-throw
    throw new Error(sanitizeErrorMessage(error));
  }
}

/**
 * Secure wrapper for exerciseOption
 * Adds validation and rate limiting
 */
export async function exerciseOptionSecure(
  optionId: number,
  userPublicKey: string
): Promise<string> {
  try {
    // Validate inputs
    const validated = validateBuyOption({ optionId, buyer: userPublicKey });

    // Check rate limit (5 exercises per minute)
    if (!clientRateLimiter.isAllowed('exercise_option', 5, 60 * 1000)) {
      const retryAfter = clientRateLimiter.getRetryAfter('exercise_option', 5, 60 * 1000);
      throw new ValidationError(
        `Rate limit exceeded. Please wait ${Math.ceil(retryAfter / 1000)} seconds before exercising another option.`
      );
    }

    // Log transaction attempt
    logSecurityEvent('exercise_option_attempt', {
      optionId: validated.optionId,
      user: validated.buyer.substring(0, 8) + '...',
    });

    // Call original function
    const result = await stellar.exerciseOption(validated.optionId, validated.buyer);

    // Log success
    logSecurityEvent('exercise_option_success', {
      optionId: validated.optionId,
      txHash: result.substring(0, 16) + '...',
    });

    return result;
  } catch (error) {
    // Log error
    logSecurityEvent('exercise_option_error', {
      optionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Sanitize and re-throw
    throw new Error(sanitizeErrorMessage(error));
  }
}

/**
 * Secure wrapper for addLiquidity
 * Adds validation and rate limiting
 */
export async function addLiquiditySecure(
  poolId: number,
  callAmount: bigint,
  putAmount: bigint,
  userPublicKey: string
): Promise<string> {
  try {
    // Validate inputs
    const validated = validateLiquidity(
      { poolId, callAmount, putAmount, user: userPublicKey },
      'add'
    );

    // Check rate limit (5 liquidity operations per minute)
    if (!clientRateLimiter.isAllowed('add_liquidity', 5, 60 * 1000)) {
      const retryAfter = clientRateLimiter.getRetryAfter('add_liquidity', 5, 60 * 1000);
      throw new ValidationError(
        `Rate limit exceeded. Please wait ${Math.ceil(retryAfter / 1000)} seconds before adding liquidity again.`
      );
    }

    // Log transaction attempt
    logSecurityEvent('add_liquidity_attempt', {
      poolId: validated.poolId,
      user: validated.user.substring(0, 8) + '...',
    });

    // Call original function
    const result = await stellar.addLiquidity(
      validated.poolId,
      validated.callAmount!,
      validated.putAmount!,
      validated.user
    );

    // Log success
    logSecurityEvent('add_liquidity_success', {
      poolId: validated.poolId,
      txHash: result.substring(0, 16) + '...',
    });

    return result;
  } catch (error) {
    // Log error
    logSecurityEvent('add_liquidity_error', {
      poolId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Sanitize and re-throw
    throw new Error(sanitizeErrorMessage(error));
  }
}

/**
 * Secure wrapper for removeLiquidity
 * Adds validation and rate limiting
 */
export async function removeLiquiditySecure(
  poolId: number,
  shares: bigint,
  userPublicKey: string
): Promise<string> {
  try {
    // Validate inputs
    const validated = validateLiquidity(
      { poolId, shares, user: userPublicKey },
      'remove'
    );

    // Check rate limit (5 liquidity operations per minute)
    if (!clientRateLimiter.isAllowed('remove_liquidity', 5, 60 * 1000)) {
      const retryAfter = clientRateLimiter.getRetryAfter('remove_liquidity', 5, 60 * 1000);
      throw new ValidationError(
        `Rate limit exceeded. Please wait ${Math.ceil(retryAfter / 1000)} seconds before removing liquidity again.`
      );
    }

    // Log transaction attempt
    logSecurityEvent('remove_liquidity_attempt', {
      poolId: validated.poolId,
      user: validated.user.substring(0, 8) + '...',
    });

    // Call original function
    const result = await stellar.removeLiquidity(
      validated.poolId,
      validated.shares!,
      validated.user
    );

    // Log success
    logSecurityEvent('remove_liquidity_success', {
      poolId: validated.poolId,
      txHash: result.substring(0, 16) + '...',
    });

    return result;
  } catch (error) {
    // Log error
    logSecurityEvent('remove_liquidity_error', {
      poolId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Sanitize and re-throw
    throw new Error(sanitizeErrorMessage(error));
  }
}

/**
 * Secure wrapper for wallet connection
 * Adds rate limiting and logging
 */
export async function connectFreighterSecure(): Promise<string | null> {
  try {
    // Check rate limit (10 connection attempts per 15 minutes)
    if (!clientRateLimiter.isAllowed('connect_wallet', 10, 15 * 60 * 1000)) {
      const retryAfter = clientRateLimiter.getRetryAfter('connect_wallet', 10, 15 * 60 * 1000);
      throw new ValidationError(
        `Too many connection attempts. Please wait ${Math.ceil(retryAfter / 1000)} seconds.`
      );
    }

    // Log connection attempt
    logSecurityEvent('wallet_connect_attempt', {});

    // Call original function
    const result = await stellar.connectFreighter();

    if (result) {
      // Validate returned address
      if (!validateStellarAddress(result, 'public')) {
        throw new ValidationError('Invalid address returned from wallet');
      }

      // Log success
      logSecurityEvent('wallet_connect_success', {
        address: result.substring(0, 8) + '...',
      });
    }

    return result;
  } catch (error) {
    // Log error
    logSecurityEvent('wallet_connect_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Sanitize and re-throw
    throw new Error(sanitizeErrorMessage(error));
  }
}

// Re-export read-only functions (no rate limiting needed for queries)
export {
  getOpenOptions,
  getOptionById,
  getUserOptions,
  getActivePools,
  getPoolById,
  getLpPosition,
  getQuote,
  getMockOptions,
  getMockPools,
  formatXLM,
  parseXLM,
  formatPrice,
  formatTimestamp,
  formatExpiry,
  isFreighterInstalled,
  getPublicKey,
  getNetwork,
  DEMO_MODE,
  DEMO_ACCOUNT,
  CONTRACTS,
  NETWORK,
} from './stellar';

// Export types
export type { EmissionOption, OptionsPool, LpPosition } from './stellar';
