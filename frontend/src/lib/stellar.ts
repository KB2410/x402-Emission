import {
    Contract,
    Keypair,
    Networks,
    TransactionBuilder,
    xdr,
    Address,
    nativeToScVal,
    scValToNative,
    SorobanRpc,
    Operation,
    BASE_FEE,
    TimeoutInfinite,
    Account
} from '@stellar/stellar-sdk'

// Contract addresses (replace with deployed addresses)
export const CONTRACTS = {
    EMISSION_OPTION: process.env.NEXT_PUBLIC_EMISSION_OPTION_CONTRACT || '',
    OPTIONS_FACTORY: process.env.NEXT_PUBLIC_OPTIONS_FACTORY_CONTRACT || '',
    COLLATERAL_MANAGER: process.env.NEXT_PUBLIC_COLLATERAL_MANAGER_CONTRACT || '',
    OPTIONS_AMM: process.env.NEXT_PUBLIC_OPTIONS_AMM_CONTRACT || '',
    SETTLEMENT_ENGINE: process.env.NEXT_PUBLIC_SETTLEMENT_ENGINE_CONTRACT || '',
    RISK_MANAGER: process.env.NEXT_PUBLIC_RISK_MANAGER_CONTRACT || '',
}

// Network configuration
export const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'TESTNET'
export const NETWORK_PASSPHRASE = NETWORK === 'MAINNET'
    ? Networks.PUBLIC
    : Networks.TESTNET

export const HORIZON_URL = NETWORK === 'MAINNET'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org'

export const SOROBAN_RPC_URL = NETWORK === 'MAINNET'
    ? 'https://soroban-rpc.mainnet.stellar.gateway.fm'
    : 'https://soroban-testnet.stellar.org'

// Initialize Soroban RPC client
export const sorobanClient = new SorobanRpc.Server(SOROBAN_RPC_URL)

// Option types
export interface EmissionOption {
    id: number
    optionType: 'Call' | 'Put'
    strikePrice: bigint
    expiration: number
    emissionPeriodStart: number
    emissionPeriodEnd: number
    underlyingAmount: bigint
    premium: bigint
    collateralAmount: bigint
    writer: string
    buyer: string | null
    status: 'Open' | 'Active' | 'Exercised' | 'Expired' | 'Settled'
    createdAt: number
}

export interface OptionsPool {
    id: number
    callLiquidity: bigint
    putLiquidity: bigint
    strikePrice: bigint
    expiration: number
    impliedVolatility: number
    totalLpShares: bigint
    feeRate: number
    isActive: boolean
}

export interface LpPosition {
    poolId: number
    shares: bigint
    callAmount: bigint
    putAmount: bigint
    entryTime: number
}

// Demo mode configuration
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' // Only enable if explicitly set to true

// Demo user account for simulation
export const DEMO_ACCOUNT = {
    publicKey: 'GCHWURXZ6US3SCIBMTH7N6DLYAG2WV63IE54G5NMJ33ZWCO4LJYWBYBK',
    balance: 1000.0, // Demo XLM balance
    name: 'Demo Account'
}

// Helper functions
export function formatXLM(stroops: bigint): string {
    const xlm = Number(stroops) / 10_000_000
    return xlm.toFixed(7)
}

export function parseXLM(xlm: string): bigint {
    return BigInt(Math.floor(parseFloat(xlm) * 10_000_000))
}

export function formatPrice(price: bigint, decimals: number = 6): string {
    const value = Number(price) / Math.pow(10, decimals)
    return `$${value.toFixed(4)}`
}

export function formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

export function formatExpiry(timestamp: number): string {
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// Wallet connection functions - now with demo mode support
export async function isFreighterInstalled(): Promise<boolean> {
    if (DEMO_MODE) return true

    if (typeof window === 'undefined') return false

    // Diagnostic logging to help debug SES/Lockdown issues
    const hasApi = !!(window as any).freighterApi
    const hasLegacy = !!(window as any).freighter

    if (!hasApi && !hasLegacy) {
        console.log('[Stellar Lib] Freighter not detected yet. Global keys check:', {
            freighterApi: hasApi,
            freighter: hasLegacy,
            windowKeys: Object.keys(window).filter(k => k.toLowerCase().includes('freight'))
        })
    }

    return hasApi || hasLegacy
}

export async function connectFreighter(): Promise<string | null> {
    try {
        if (DEMO_MODE) {
            return DEMO_ACCOUNT.publicKey
        }

        // More aggressive polling check (up to 2 seconds)
        let installed = await isFreighterInstalled()
        let retries = 0
        while (!installed && retries < 4) {
            await new Promise(r => setTimeout(r, 500))
            installed = await isFreighterInstalled()
            retries++
        }

        if (!installed) {
            throw new Error('Freighter wallet not found. Please ensure the extension is enabled and refresh the page.')
        }

        // Give extension one more moment to fully initialize
        await new Promise(r => setTimeout(r, 500))
        
        // Request access to the wallet
        const api = (window as any).freighterApi || (window as any).freighter
        if (!api) {
            throw new Error('Freighter API vanished during connection attempt')
        }
        const publicKey = await api.requestAccess()
        return publicKey
    } catch (error) {
        console.error('Error connecting to Freighter:', error)
        throw error
    }
}

export async function getPublicKey(): Promise<string | null> {
    try {
        if (DEMO_MODE) {
            return DEMO_ACCOUNT.publicKey
        }

        let api = (window as any).freighterApi || (window as any).freighter
        if (!api) {
            // Quick retry for public key as well
            await new Promise(r => setTimeout(r, 200))
            api = (window as any).freighterApi || (window as any).freighter
        }

        if (!api) return null

        return await api.getPublicKey()
    } catch (error) {
        console.error('Error getting public key:', error)
        return null
    }
}

export async function getNetwork(): Promise<string | null> {
    try {
        if (DEMO_MODE) {
            return 'TESTNET'
        }

        const api = (window as any).freighterApi || (window as any).freighter
        if (!api) return null

        return await api.getNetwork()
    } catch (error) {
        console.error('Error getting network:', error)
        return null
    }
}

export async function signTransaction(xdr: string): Promise<string | null> {
    try {
        if (DEMO_MODE) return xdr

        const api = (window as any).freighterApi || (window as any).freighter
        if (!api) return null

        return await api.signTransaction(xdr)
    } catch (error) {
        console.error('Error signing transaction:', error)
        return null
    }
}

// Helper to build and submit transactions
async function buildAndSubmitTransaction(
    contractAddress: string,
    method: string,
    args: xdr.ScVal[],
    userPublicKey: string
): Promise<string> {
    if (!contractAddress) {
        throw new Error('Contract address not configured')
    }

    const contract = new Contract(contractAddress)
    const account = await sorobanClient.getAccount(userPublicKey)

    const operation = contract.call(method, ...args)

    const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(operation)
        .setTimeout(TimeoutInfinite)
        .build()

    // Simulate transaction first
    const simulated = await sorobanClient.simulateTransaction(transaction)

    if (SorobanRpc.Api.isSimulationError(simulated)) {
        throw new Error(`Simulation failed: ${simulated.error}`)
    }

    // Prepare transaction with simulation results
    const prepared = SorobanRpc.assembleTransaction(transaction, simulated)

    // Sign transaction
    const signedXdr = await signTransaction((prepared as any).toXDR())
    if (!signedXdr) {
        throw new Error('Transaction signing failed')
    }

    const signedTransaction = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)

    // Submit transaction
    const result = await sorobanClient.sendTransaction(signedTransaction)

    if (result.status === 'ERROR') {
        throw new Error(`Transaction failed: ${result.status}`)
    }

    // Wait for confirmation
    let getResponse = await sorobanClient.getTransaction(result.hash)

    while (getResponse.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        getResponse = await sorobanClient.getTransaction(result.hash)
    }

    if (getResponse.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`Transaction failed: ${getResponse.resultXdr}`)
    }

    return result.hash
}

// Helper to query contract state
async function queryContract(
    contractAddress: string,
    method: string,
    args: xdr.ScVal[] = []
): Promise<any> {
    if (!contractAddress) {
        return null
    }

    try {
        const contract = new Contract(contractAddress)
        const dummyKeypair = Keypair.random()
        const account = new Account(dummyKeypair.publicKey(), '0')

        const operation = contract.call(method, ...args)

        const transaction = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(operation)
            .setTimeout(TimeoutInfinite)
            .build()

        const simulated = await sorobanClient.simulateTransaction(transaction)

        if (SorobanRpc.Api.isSimulationError(simulated)) {
            console.warn(`Contract query simulation failed for ${method}:`, simulated.error)
            return null
        }

        if (simulated.result?.retval) {
            try {
                return scValToNative(simulated.result.retval)
            } catch (parseError) {
                console.warn(`Failed to parse contract response for ${method}:`, parseError)
                return null
            }
        }

        return null
    } catch (error) {
        // Suppress XDR parsing errors - these are expected when contracts aren't initialized
        if (error instanceof Error && error.message.includes('Bad union switch')) {
            console.warn(`Contract ${method} not initialized or returned unexpected data. Using mock data.`)
        } else {
            console.warn(`Contract query error for ${method}:`, error)
        }
        return null
    }
}

// Convert native values to ScVal for contract calls
function toScVal(value: any): xdr.ScVal {
    return nativeToScVal(value)
}

// Contract interaction functions
export async function getOpenOptions(): Promise<EmissionOption[]> {
    try {
        // If no contract address is configured, use mock data
        if (!CONTRACTS.EMISSION_OPTION || CONTRACTS.EMISSION_OPTION === '') {
            console.info('📊 Using mock data: No emission option contract configured')
            return getMockOptions()
        }

        const result = await queryContract(CONTRACTS.EMISSION_OPTION, 'get_open_options')

        if (!result || !Array.isArray(result)) {
            console.info('📊 Using mock data: Contract returned no options or needs initialization')
            return getMockOptions() // Fallback to mock data
        }

        return result.map((option: any) => ({
            id: Number(option.id),
            optionType: option.option_type === 'Call' ? 'Call' : 'Put',
            strikePrice: BigInt(option.strike_price),
            expiration: Number(option.expiration),
            emissionPeriodStart: Number(option.emission_period_start),
            emissionPeriodEnd: Number(option.emission_period_end),
            underlyingAmount: BigInt(option.underlying_amount),
            premium: BigInt(option.premium),
            collateralAmount: BigInt(option.collateral_amount),
            writer: option.writer,
            buyer: option.buyer || null,
            status: option.status,
            createdAt: Number(option.created_at),
        }))
    } catch (error) {
        console.info('📊 Using mock data: Contract query failed')
        return getMockOptions() // Fallback to mock data
    }
}

export async function getOptionById(id: number): Promise<EmissionOption | null> {
    try {
        const result = await queryContract(
            CONTRACTS.EMISSION_OPTION,
            'get_option',
            [toScVal(id)]
        )

        if (!result) {
            return null
        }

        return {
            id: Number(result.id),
            optionType: result.option_type === 'Call' ? 'Call' : 'Put',
            strikePrice: BigInt(result.strike_price),
            expiration: Number(result.expiration),
            emissionPeriodStart: Number(result.emission_period_start),
            emissionPeriodEnd: Number(result.emission_period_end),
            underlyingAmount: BigInt(result.underlying_amount),
            premium: BigInt(result.premium),
            collateralAmount: BigInt(result.collateral_amount),
            writer: result.writer,
            buyer: result.buyer || null,
            status: result.status,
            createdAt: Number(result.created_at),
        }
    } catch (error) {
        console.error('Error fetching option:', error)
        return null
    }
}

export async function getUserOptions(userAddress: string): Promise<number[]> {
    try {
        const result = await queryContract(
            CONTRACTS.EMISSION_OPTION,
            'get_user_options',
            [toScVal(userAddress)]
        )

        return result || []
    } catch (error) {
        console.error('Error fetching user options:', error)
        return []
    }
}

export async function buyOption(optionId: number, userPublicKey: string): Promise<string> {
    try {
        if (DEMO_MODE) {
            // Simulate transaction in demo mode
            await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate network delay
            return `demo_tx_${Date.now()}_buy_option_${optionId}` // Return mock transaction hash
        }

        // The buy_option contract function expects: (buyer: Address, option_id: u64)
        const hash = await buildAndSubmitTransaction(
            CONTRACTS.EMISSION_OPTION,
            'buy_option',
            [
                nativeToScVal(userPublicKey, { type: 'address' }),
                toScVal(optionId)
            ],
            userPublicKey
        )

        return hash
    } catch (error) {
        console.error('Error buying option:', error)
        
        // Provide user-friendly error messages
        if (error instanceof Error) {
            if (error.message.includes('Error(Contract, #5)')) {
                throw new Error('This option does not exist on-chain. Please create real options first using the Write page or run the create-test-options.sh script.')
            } else if (error.message.includes('Error(Contract, #6)')) {
                throw new Error('This option has already been purchased by another user.')
            } else if (error.message.includes('Error(Contract, #7)')) {
                throw new Error('This option has expired and can no longer be purchased.')
            } else if (error.message.includes('Error(Contract, #10)')) {
                throw new Error('Insufficient payment. Please ensure you have enough XLM to cover the premium.')
            }
        }
        
        throw error
    }
}

export async function writeOption(
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
        if (DEMO_MODE) {
            // Simulate transaction in demo mode
            await new Promise(resolve => setTimeout(resolve, 2500)) // Simulate network delay
            return `demo_tx_${Date.now()}_write_option_${optionType.toLowerCase()}` // Return mock transaction hash
        }

        // The write_option contract function expects:
        // (writer: Address, option_type: OptionType, strike_price: i128, expiration: u64,
        //  emission_period_start: u64, emission_period_end: u64, underlying_amount: i128,
        //  premium: i128, collateral_amount: i128)
        const hash = await buildAndSubmitTransaction(
            CONTRACTS.EMISSION_OPTION,
            'write_option',
            [
                nativeToScVal(userPublicKey, { type: 'address' }),
                toScVal(optionType),
                toScVal(strikePrice.toString()),
                toScVal(expiration),
                toScVal(emissionPeriodStart),
                toScVal(emissionPeriodEnd),
                toScVal(underlyingAmount.toString()),
                toScVal(premium.toString()),
                toScVal(collateralAmount.toString()),
            ],
            userPublicKey
        )

        return hash
    } catch (error) {
        console.error('Error writing option:', error)
        
        // Provide user-friendly error messages
        if (error instanceof Error) {
            if (error.message.includes('Error(Contract, #1)')) {
                throw new Error('Contract not initialized. Please contact the administrator.')
            } else if (error.message.includes('Error(Contract, #11)')) {
                throw new Error('Invalid amount. Please check your input values.')
            } else if (error.message.includes('Error(Contract, #12)')) {
                throw new Error('Invalid strike price. Strike price must be greater than 0.')
            } else if (error.message.includes('Error(Contract, #13)')) {
                throw new Error('Invalid expiration. Expiration must be in the future.')
            } else if (error.message.includes('Error(Contract, #16)')) {
                throw new Error('Token transfer failed. Please ensure you have approved the contract and have sufficient balance.')
            }
        }
        
        throw error
    }
}

export async function exerciseOption(optionId: number, userPublicKey: string): Promise<string> {
    try {
        const hash = await buildAndSubmitTransaction(
            CONTRACTS.EMISSION_OPTION,
            'exercise_option',
            [toScVal(optionId)],
            userPublicKey
        )

        return hash
    } catch (error) {
        console.error('Error exercising option:', error)
        throw error
    }
}

// AMM Contract Functions
export async function getActivePools(): Promise<OptionsPool[]> {
    try {
        // If no contract address is configured, use mock data
        if (!CONTRACTS.OPTIONS_AMM || CONTRACTS.OPTIONS_AMM === '') {
            console.info('📊 Using mock data: No options AMM contract configured')
            return getMockPools()
        }

        const result = await queryContract(CONTRACTS.OPTIONS_AMM, 'get_active_pools')

        if (!result || !Array.isArray(result)) {
            console.info('📊 Using mock data: Contract returned no pools or needs initialization')
            return getMockPools() // Fallback to mock data
        }

        return result.map((pool: any) => ({
            id: Number(pool.id),
            callLiquidity: BigInt(pool.call_liquidity),
            putLiquidity: BigInt(pool.put_liquidity),
            strikePrice: BigInt(pool.strike_price),
            expiration: Number(pool.expiration),
            impliedVolatility: Number(pool.implied_volatility),
            totalLpShares: BigInt(pool.total_lp_shares),
            feeRate: Number(pool.fee_rate),
            isActive: Boolean(pool.is_active),
        }))
    } catch (error) {
        console.info('📊 Using mock data: Contract query failed')
        return getMockPools() // Fallback to mock data
    }
}

export async function getPoolById(id: number): Promise<OptionsPool | null> {
    try {
        const result = await queryContract(
            CONTRACTS.OPTIONS_AMM,
            'get_pool',
            [toScVal(id)]
        )

        if (!result) {
            return null
        }

        return {
            id: Number(result.id),
            callLiquidity: BigInt(result.call_liquidity),
            putLiquidity: BigInt(result.put_liquidity),
            strikePrice: BigInt(result.strike_price),
            expiration: Number(result.expiration),
            impliedVolatility: Number(result.implied_volatility),
            totalLpShares: BigInt(result.total_lp_shares),
            feeRate: Number(result.fee_rate),
            isActive: Boolean(result.is_active),
        }
    } catch (error) {
        console.error('Error fetching pool:', error)
        return null
    }
}

export async function getLpPosition(userAddress: string, poolId: number): Promise<LpPosition | null> {
    try {
        const result = await queryContract(
            CONTRACTS.OPTIONS_AMM,
            'get_lp_position',
            [toScVal(userAddress), toScVal(poolId)]
        )

        if (!result) {
            return null
        }

        return {
            poolId: Number(result.pool_id),
            shares: BigInt(result.shares),
            callAmount: BigInt(result.call_amount),
            putAmount: BigInt(result.put_amount),
            entryTime: Number(result.entry_time),
        }
    } catch (error) {
        console.error('Error fetching LP position:', error)
        return null
    }
}

export async function addLiquidity(
    poolId: number,
    callAmount: bigint,
    putAmount: bigint,
    userPublicKey: string
): Promise<string> {
    try {
        if (DEMO_MODE) {
            // Simulate transaction in demo mode
            await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate network delay
            return `demo_tx_${Date.now()}_add_liquidity_${poolId}` // Return mock transaction hash
        }

        // The add_liquidity contract function expects:
        // (provider: Address, pool_id: u64, call_amount: i128, put_amount: i128)
        const hash = await buildAndSubmitTransaction(
            CONTRACTS.OPTIONS_AMM,
            'add_liquidity',
            [
                nativeToScVal(userPublicKey, { type: 'address' }),
                toScVal(poolId),
                toScVal(callAmount.toString()),
                toScVal(putAmount.toString()),
            ],
            userPublicKey
        )

        return hash
    } catch (error) {
        console.error('Error adding liquidity:', error)
        
        // Provide user-friendly error messages
        if (error instanceof Error) {
            if (error.message.includes('UnreachableCodeReached') || error.message.includes('PoolNotFound')) {
                throw new Error(`Pool #${poolId} does not exist on-chain. Pools need to be created first before adding liquidity. The pools you see are mock data for demonstration purposes.`)
            } else if (error.message.includes('NotInitialized')) {
                throw new Error('The AMM contract has not been initialized. Please run the initialization script first.')
            } else if (error.message.includes('InsufficientBalance')) {
                throw new Error('Insufficient XLM balance. Please ensure you have enough XLM to add liquidity.')
            }
        }
        
        throw error
    }
}

export async function removeLiquidity(
    poolId: number,
    shares: bigint,
    userPublicKey: string
): Promise<string> {
    try {
        if (DEMO_MODE) {
            // Simulate transaction in demo mode
            await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate network delay
            return `demo_tx_${Date.now()}_remove_liquidity_${poolId}` // Return mock transaction hash
        }

        // The remove_liquidity contract function expects:
        // (provider: Address, pool_id: u64, shares_to_burn: i128)
        const hash = await buildAndSubmitTransaction(
            CONTRACTS.OPTIONS_AMM,
            'remove_liquidity',
            [
                nativeToScVal(userPublicKey, { type: 'address' }),
                toScVal(poolId),
                toScVal(shares.toString()),
            ],
            userPublicKey
        )

        return hash
    } catch (error) {
        console.error('Error removing liquidity:', error)
        throw error
    }
}

export async function getQuote(
    poolId: number,
    optionType: 'Call' | 'Put',
    amount: bigint,
    isBuy: boolean
): Promise<{ premium: bigint; newIv: number } | null> {
    try {
        const result = await queryContract(
            CONTRACTS.OPTIONS_AMM,
            'get_quote',
            [
                toScVal(poolId),
                toScVal(optionType),
                toScVal(amount.toString()),
                toScVal(isBuy),
            ]
        )

        if (!result) {
            return null
        }

        return {
            premium: BigInt(result.premium),
            newIv: Number(result.new_iv),
        }
    } catch (error) {
        console.error('Error getting quote:', error)
        return null
    }
}

// Mock data for development
export function getMockOptions(): EmissionOption[] {
    return [
        {
            id: 1,
            optionType: 'Call',
            strikePrice: BigInt(150000), // $0.15
            expiration: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            emissionPeriodStart: Math.floor(Date.now() / 1000),
            emissionPeriodEnd: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
            underlyingAmount: BigInt(10000_0000000),
            premium: BigInt(80000),
            collateralAmount: BigInt(10000_0000000),
            writer: 'GWRITER...',
            buyer: null,
            status: 'Open',
            createdAt: Math.floor(Date.now() / 1000) - 24 * 60 * 60,
        },
        {
            id: 2,
            optionType: 'Put',
            strikePrice: BigInt(100000), // $0.10
            expiration: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            emissionPeriodStart: Math.floor(Date.now() / 1000),
            emissionPeriodEnd: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
            underlyingAmount: BigInt(5000_0000000),
            premium: BigInt(50000),
            collateralAmount: BigInt(5000_0000000),
            writer: 'GWRITER...',
            buyer: null,
            status: 'Open',
            createdAt: Math.floor(Date.now() / 1000) - 12 * 60 * 60,
        },
    ]
}

export function getMockPools(): OptionsPool[] {
    return [
        {
            id: 1,
            callLiquidity: BigInt(50000_0000000),
            putLiquidity: BigInt(30000_0000000),
            strikePrice: BigInt(150000),
            expiration: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            impliedVolatility: 6200,
            totalLpShares: BigInt(80000_0000000),
            feeRate: 30,
            isActive: true,
        },
    ]
}
