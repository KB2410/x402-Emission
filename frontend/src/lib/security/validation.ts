/**
 * Input Validation & Sanitization
 * 
 * OWASP Best Practices:
 * - Schema-based validation with strict type checking
 * - Length limits on all string inputs
 * - Whitelist approach for allowed characters
 * - Reject unexpected fields
 * - Sanitize all user inputs before processing
 */

import { Address } from '@stellar/stellar-sdk';

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Stellar address validation
 * Validates both G... (public key) and S... (secret key) formats
 */
export function validateStellarAddress(address: string, type: 'public' | 'secret' = 'public'): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Check prefix
  const expectedPrefix = type === 'public' ? 'G' : 'S';
  if (!address.startsWith(expectedPrefix)) {
    return false;
  }

  // Check length (Stellar addresses are 56 characters)
  if (address.length !== 56) {
    return false;
  }

  // Use Stellar SDK validation
  try {
    if (type === 'public') {
      Address.fromString(address);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize string input
 * Removes potentially dangerous characters
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    throw new ValidationError('Input must be a string');
  }

  // Trim whitespace
  let sanitized = input.trim();

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized;
}

/**
 * Validate and sanitize numeric input
 */
export function validateNumber(
  value: any,
  options: {
    min?: number;
    max?: number;
    integer?: boolean;
    positive?: boolean;
  } = {}
): number {
  const num = Number(value);

  if (isNaN(num) || !isFinite(num)) {
    throw new ValidationError('Invalid number');
  }

  if (options.integer && !Number.isInteger(num)) {
    throw new ValidationError('Number must be an integer');
  }

  if (options.positive && num <= 0) {
    throw new ValidationError('Number must be positive');
  }

  if (options.min !== undefined && num < options.min) {
    throw new ValidationError(`Number must be at least ${options.min}`);
  }

  if (options.max !== undefined && num > options.max) {
    throw new ValidationError(`Number must be at most ${options.max}`);
  }

  return num;
}

/**
 * Validate BigInt input (for token amounts)
 */
export function validateBigInt(
  value: any,
  options: {
    min?: bigint;
    max?: bigint;
    positive?: boolean;
  } = {}
): bigint {
  let bigIntValue: bigint;

  try {
    bigIntValue = BigInt(value);
  } catch {
    throw new ValidationError('Invalid BigInt value');
  }

  if (options.positive && bigIntValue <= 0n) {
    throw new ValidationError('Value must be positive');
  }

  if (options.min !== undefined && bigIntValue < options.min) {
    throw new ValidationError(`Value must be at least ${options.min}`);
  }

  if (options.max !== undefined && bigIntValue > options.max) {
    throw new ValidationError(`Value must be at most ${options.max}`);
  }

  return bigIntValue;
}

/**
 * Validate option type
 */
export function validateOptionType(type: any): 'Call' | 'Put' {
  if (type !== 'Call' && type !== 'Put') {
    throw new ValidationError('Option type must be "Call" or "Put"', 'optionType');
  }
  return type;
}

/**
 * Validate timestamp (Unix timestamp in seconds)
 */
export function validateTimestamp(
  timestamp: any,
  options: {
    future?: boolean;
    past?: boolean;
    maxFuture?: number; // Maximum seconds in the future
  } = {}
): number {
  const ts = validateNumber(timestamp, { integer: true, positive: true });
  const now = Math.floor(Date.now() / 1000);

  if (options.future && ts <= now) {
    throw new ValidationError('Timestamp must be in the future', 'timestamp');
  }

  if (options.past && ts >= now) {
    throw new ValidationError('Timestamp must be in the past', 'timestamp');
  }

  if (options.maxFuture && ts > now + options.maxFuture) {
    throw new ValidationError(
      `Timestamp cannot be more than ${options.maxFuture} seconds in the future`,
      'timestamp'
    );
  }

  return ts;
}

/**
 * Schema for option creation
 */
export interface CreateOptionSchema {
  optionType: 'Call' | 'Put';
  strikePrice: bigint;
  expiration: number;
  emissionPeriodStart: number;
  emissionPeriodEnd: number;
  underlyingAmount: bigint;
  premium: bigint;
  collateralAmount: bigint;
  writer: string;
}

/**
 * Validate option creation input
 */
export function validateCreateOption(input: any): CreateOptionSchema {
  // Reject unexpected fields
  const allowedFields = new Set([
    'optionType',
    'strikePrice',
    'expiration',
    'emissionPeriodStart',
    'emissionPeriodEnd',
    'underlyingAmount',
    'premium',
    'collateralAmount',
    'writer',
  ]);

  for (const key of Object.keys(input)) {
    if (!allowedFields.has(key)) {
      throw new ValidationError(`Unexpected field: ${key}`, key);
    }
  }

  // Validate required fields
  if (!input.optionType) {
    throw new ValidationError('Option type is required', 'optionType');
  }
  if (!input.strikePrice) {
    throw new ValidationError('Strike price is required', 'strikePrice');
  }
  if (!input.expiration) {
    throw new ValidationError('Expiration is required', 'expiration');
  }
  if (!input.underlyingAmount) {
    throw new ValidationError('Underlying amount is required', 'underlyingAmount');
  }
  if (!input.premium) {
    throw new ValidationError('Premium is required', 'premium');
  }
  if (!input.collateralAmount) {
    throw new ValidationError('Collateral amount is required', 'collateralAmount');
  }
  if (!input.writer) {
    throw new ValidationError('Writer address is required', 'writer');
  }

  // Validate and sanitize each field
  const optionType = validateOptionType(input.optionType);
  
  const strikePrice = validateBigInt(input.strikePrice, {
    positive: true,
    min: 1n,
    max: 1000000000000n, // 100,000 XLM max strike
  });

  const expiration = validateTimestamp(input.expiration, {
    future: true,
    maxFuture: 365 * 24 * 60 * 60, // Max 1 year in future
  });

  const emissionPeriodStart = validateTimestamp(input.emissionPeriodStart);
  const emissionPeriodEnd = validateTimestamp(input.emissionPeriodEnd);

  // Validate emission period logic
  if (emissionPeriodEnd <= emissionPeriodStart) {
    throw new ValidationError(
      'Emission period end must be after start',
      'emissionPeriodEnd'
    );
  }

  const underlyingAmount = validateBigInt(input.underlyingAmount, {
    positive: true,
    min: 1n,
    max: 1000000000000000n, // 100M XLM max
  });

  const premium = validateBigInt(input.premium, {
    positive: true,
    min: 1n,
    max: 100000000000n, // 10,000 XLM max premium
  });

  const collateralAmount = validateBigInt(input.collateralAmount, {
    positive: true,
    min: 1n,
    max: 1000000000000000n, // 100M XLM max
  });

  // Validate writer address
  if (!validateStellarAddress(input.writer, 'public')) {
    throw new ValidationError('Invalid writer address', 'writer');
  }

  return {
    optionType,
    strikePrice,
    expiration,
    emissionPeriodStart,
    emissionPeriodEnd,
    underlyingAmount,
    premium,
    collateralAmount,
    writer: input.writer,
  };
}

/**
 * Schema for buying options
 */
export interface BuyOptionSchema {
  optionId: number;
  buyer: string;
  amount?: number;
}

/**
 * Validate buy option input
 */
export function validateBuyOption(input: any): BuyOptionSchema {
  // Reject unexpected fields
  const allowedFields = new Set(['optionId', 'buyer', 'amount']);

  for (const key of Object.keys(input)) {
    if (!allowedFields.has(key)) {
      throw new ValidationError(`Unexpected field: ${key}`, key);
    }
  }

  // Validate required fields
  if (input.optionId === undefined || input.optionId === null) {
    throw new ValidationError('Option ID is required', 'optionId');
  }
  if (!input.buyer) {
    throw new ValidationError('Buyer address is required', 'buyer');
  }

  const optionId = validateNumber(input.optionId, {
    integer: true,
    min: 0,
    max: 1000000, // Reasonable max option ID
  });

  // Validate buyer address
  if (!validateStellarAddress(input.buyer, 'public')) {
    throw new ValidationError('Invalid buyer address', 'buyer');
  }

  const amount = input.amount
    ? validateNumber(input.amount, {
        integer: true,
        positive: true,
        min: 1,
        max: 1000000,
      })
    : undefined;

  return {
    optionId,
    buyer: input.buyer,
    amount,
  };
}

/**
 * Schema for liquidity operations
 */
export interface LiquiditySchema {
  poolId: number;
  callAmount?: bigint;
  putAmount?: bigint;
  shares?: bigint;
  user: string;
}

/**
 * Validate liquidity operation input
 */
export function validateLiquidity(input: any, operation: 'add' | 'remove'): LiquiditySchema {
  // Reject unexpected fields
  const allowedFields = new Set(['poolId', 'callAmount', 'putAmount', 'shares', 'user']);

  for (const key of Object.keys(input)) {
    if (!allowedFields.has(key)) {
      throw new ValidationError(`Unexpected field: ${key}`, key);
    }
  }

  // Validate required fields
  if (input.poolId === undefined || input.poolId === null) {
    throw new ValidationError('Pool ID is required', 'poolId');
  }
  if (!input.user) {
    throw new ValidationError('User address is required', 'user');
  }

  const poolId = validateNumber(input.poolId, {
    integer: true,
    min: 0,
    max: 100000,
  });

  // Validate user address
  if (!validateStellarAddress(input.user, 'public')) {
    throw new ValidationError('Invalid user address', 'user');
  }

  let callAmount: bigint | undefined;
  let putAmount: bigint | undefined;
  let shares: bigint | undefined;

  if (operation === 'add') {
    if (!input.callAmount && !input.putAmount) {
      throw new ValidationError('At least one of callAmount or putAmount is required');
    }

    if (input.callAmount) {
      callAmount = validateBigInt(input.callAmount, {
        positive: true,
        max: 1000000000000000n,
      });
    }

    if (input.putAmount) {
      putAmount = validateBigInt(input.putAmount, {
        positive: true,
        max: 1000000000000000n,
      });
    }
  } else {
    // remove operation
    if (!input.shares) {
      throw new ValidationError('Shares amount is required for remove operation', 'shares');
    }

    shares = validateBigInt(input.shares, {
      positive: true,
      max: 1000000000000000n,
    });
  }

  return {
    poolId,
    callAmount,
    putAmount,
    shares,
    user: input.user,
  };
}

/**
 * Sanitize object by removing unexpected fields
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: any,
  allowedFields: Set<string>
): Partial<T> {
  const sanitized: any = {};

  for (const key of Object.keys(obj)) {
    if (allowedFields.has(key)) {
      sanitized[key] = obj[key];
    }
  }

  return sanitized;
}

/**
 * Validate contract address
 */
export function validateContractAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Contract addresses start with 'C' and are 56 characters
  if (!address.startsWith('C') || address.length !== 56) {
    return false;
  }

  return true;
}

/**
 * Validate transaction hash
 */
export function validateTransactionHash(hash: string): boolean {
  if (!hash || typeof hash !== 'string') {
    return false;
  }

  // Transaction hashes are 64 character hex strings
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Rate limit validation - ensure reasonable request frequency
 */
export function validateRequestFrequency(
  lastRequestTime: number,
  minIntervalMs: number = 100
): void {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < minIntervalMs) {
    throw new ValidationError(
      `Requests too frequent. Please wait ${minIntervalMs}ms between requests.`
    );
  }
}
