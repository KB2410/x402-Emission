/**
 * Secure Environment Variable Handling
 * 
 * OWASP Best Practices:
 * - Never expose sensitive keys client-side
 * - Validate all environment variables
 * - Provide secure defaults
 * - Clear error messages for missing configuration
 * - Type-safe access to environment variables
 */

/**
 * Validation error for environment variables
 */
export class EnvValidationError extends Error {
  constructor(message: string, public variable: string) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

/**
 * Validate that a required environment variable exists
 */
function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new EnvValidationError(
      `Required environment variable ${name} is not set. Please check your .env.local file.`,
      name
    );
  }
  return value.trim();
}

/**
 * Get optional environment variable with default
 */
function getEnv(name: string, defaultValue: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : defaultValue;
}

/**
 * Validate Stellar network
 */
function validateNetwork(network: string): 'TESTNET' | 'MAINNET' {
  const normalized = network.toUpperCase();
  if (normalized !== 'TESTNET' && normalized !== 'MAINNET') {
    throw new EnvValidationError(
      `Invalid network: ${network}. Must be TESTNET or MAINNET.`,
      'NEXT_PUBLIC_STELLAR_NETWORK'
    );
  }
  return normalized as 'TESTNET' | 'MAINNET';
}

/**
 * Validate contract address format
 */
function validateContractAddress(address: string, name: string): string {
  if (!address.startsWith('C') || address.length !== 56) {
    throw new EnvValidationError(
      `Invalid contract address format for ${name}. Must start with 'C' and be 56 characters.`,
      name
    );
  }
  return address;
}

/**
 * Validate boolean environment variable
 */
function validateBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  const normalized = value.toLowerCase().trim();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  return defaultValue;
}

/**
 * Client-safe environment configuration
 * Only includes variables that are safe to expose to the browser
 */
export const clientEnv = {
  // Network configuration
  network: validateNetwork(
    getEnv('NEXT_PUBLIC_STELLAR_NETWORK', 'TESTNET')
  ),

  // Demo mode (safe to expose)
  demoMode: validateBoolean(
    process.env.NEXT_PUBLIC_DEMO_MODE,
    false
  ),

  // Contract addresses (public information on blockchain)
  contracts: {
    priceOracle: process.env.NEXT_PUBLIC_PRICE_ORACLE_CONTRACT
      ? validateContractAddress(
          process.env.NEXT_PUBLIC_PRICE_ORACLE_CONTRACT,
          'NEXT_PUBLIC_PRICE_ORACLE_CONTRACT'
        )
      : '',
    
    emissionOption: process.env.NEXT_PUBLIC_EMISSION_OPTION_CONTRACT
      ? validateContractAddress(
          process.env.NEXT_PUBLIC_EMISSION_OPTION_CONTRACT,
          'NEXT_PUBLIC_EMISSION_OPTION_CONTRACT'
        )
      : '',
    
    optionsFactory: process.env.NEXT_PUBLIC_OPTIONS_FACTORY_CONTRACT
      ? validateContractAddress(
          process.env.NEXT_PUBLIC_OPTIONS_FACTORY_CONTRACT,
          'NEXT_PUBLIC_OPTIONS_FACTORY_CONTRACT'
        )
      : '',
    
    collateralManager: process.env.NEXT_PUBLIC_COLLATERAL_MANAGER_CONTRACT
      ? validateContractAddress(
          process.env.NEXT_PUBLIC_COLLATERAL_MANAGER_CONTRACT,
          'NEXT_PUBLIC_COLLATERAL_MANAGER_CONTRACT'
        )
      : '',
    
    optionsAmm: process.env.NEXT_PUBLIC_OPTIONS_AMM_CONTRACT
      ? validateContractAddress(
          process.env.NEXT_PUBLIC_OPTIONS_AMM_CONTRACT,
          'NEXT_PUBLIC_OPTIONS_AMM_CONTRACT'
        )
      : '',
    
    settlementEngine: process.env.NEXT_PUBLIC_SETTLEMENT_ENGINE_CONTRACT
      ? validateContractAddress(
          process.env.NEXT_PUBLIC_SETTLEMENT_ENGINE_CONTRACT,
          'NEXT_PUBLIC_SETTLEMENT_ENGINE_CONTRACT'
        )
      : '',
    
    riskManager: process.env.NEXT_PUBLIC_RISK_MANAGER_CONTRACT
      ? validateContractAddress(
          process.env.NEXT_PUBLIC_RISK_MANAGER_CONTRACT,
          'NEXT_PUBLIC_RISK_MANAGER_CONTRACT'
        )
      : '',
  },

  // RPC URLs (public endpoints)
  rpc: {
    horizon: getEnv(
      'NEXT_PUBLIC_HORIZON_URL',
      'https://horizon-testnet.stellar.org'
    ),
    soroban: getEnv(
      'NEXT_PUBLIC_SOROBAN_RPC_URL',
      'https://soroban-testnet.stellar.org'
    ),
  },
} as const;

/**
 * Server-only environment configuration
 * NEVER expose these to the client
 * 
 * Note: In a pure client-side Next.js app, we don't have server-side secrets.
 * This is here for future API routes if needed.
 */
export const serverEnv = {
  // Example: API keys for server-side operations
  // These should NEVER be prefixed with NEXT_PUBLIC_
  
  // stellarSecretKey: process.env.STELLAR_SECRET_KEY, // NEVER expose this!
  // apiKey: process.env.API_KEY,
  // databaseUrl: process.env.DATABASE_URL,
} as const;

/**
 * Validate all required environment variables on startup
 * This runs once when the module is imported
 */
export function validateEnvironment(): void {
  try {
    // Validate network
    clientEnv.network;

    // Warn if contracts are not configured (but don't fail)
    if (!clientEnv.contracts.emissionOption) {
      console.warn(
        '⚠️  Warning: NEXT_PUBLIC_EMISSION_OPTION_CONTRACT is not set. ' +
        'Contract interactions will not work.'
      );
    }

    console.log('✅ Environment validation passed');
    console.log(`📡 Network: ${clientEnv.network}`);
    console.log(`🎭 Demo Mode: ${clientEnv.demoMode ? 'Enabled' : 'Disabled'}`);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error('❌ Environment validation failed:');
      console.error(`   Variable: ${error.variable}`);
      console.error(`   Error: ${error.message}`);
      console.error('\n💡 Please check your .env.local file and ensure all required variables are set.');
    }
    throw error;
  }
}

/**
 * Get network passphrase for Stellar SDK
 */
export function getNetworkPassphrase(): string {
  return clientEnv.network === 'MAINNET'
    ? 'Public Global Stellar Network ; September 2015'
    : 'Test SDF Network ; September 2015';
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Sanitize environment variable for logging
 * Masks sensitive parts of the value
 */
export function sanitizeForLogging(value: string, showChars: number = 4): string {
  if (!value || value.length <= showChars * 2) {
    return '***';
  }
  return `${value.slice(0, showChars)}...${value.slice(-showChars)}`;
}

// Run validation on module load (only in browser)
if (typeof window !== 'undefined') {
  try {
    validateEnvironment();
  } catch (error) {
    // Log error but don't crash the app
    console.error('Environment validation failed:', error);
  }
}
