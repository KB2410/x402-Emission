#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    symbol_short, Address, Env, Vec, log,
    token::TokenClient,
};

/// Pool for a specific strike/expiry combination
#[contracttype]
#[derive(Clone, Debug)]
pub struct OptionsPool {
    pub id: u64,
    pub call_liquidity: i128,      // Liquidity for calls
    pub put_liquidity: i128,       // Liquidity for puts
    pub strike_price: i128,        // Strike price
    pub expiration: u64,           // Expiration timestamp
    pub implied_volatility: u32,   // IV * 100 (e.g., 5000 = 50%)
    pub total_lp_shares: i128,     // Total LP shares outstanding
    pub fee_rate: u32,             // Trading fee in basis points
    pub is_active: bool,
    pub created_at: u64,
}

/// LP position for a user in a pool
#[contracttype]
#[derive(Clone, Debug)]
pub struct LpPosition {
    pub pool_id: u64,
    pub shares: i128,
    pub call_amount: i128,
    pub put_amount: i128,
    pub entry_time: u64,
}

/// Pricing parameters for Black-Scholes approximation
#[contracttype]
#[derive(Clone, Debug)]
pub struct PricingParams {
    pub spot_price: i128,          // Current XLM price (6 decimals)
    pub risk_free_rate: u32,       // Risk-free rate * 10000
    pub base_volatility: u32,      // Base IV * 100
}

/// Storage keys
#[contracttype]
pub enum DataKey {
    Admin,
    Pool(u64),
    PoolCounter,
    UserLp(Address, u64),          // User -> Pool -> Position
    UserPools(Address),
    ActivePools,
    LiquidityToken,
    SettlementToken,
    PricingParams,
    TotalVolume,
    ProtocolFees,
    Oracle,
}

/// Contract errors
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    PoolNotFound = 4,
    PoolInactive = 5,
    InsufficientLiquidity = 6,
    InsufficientShares = 7,
    InvalidAmount = 8,
    PoolExpired = 9,
    SlippageExceeded = 10,
    InvalidStrike = 11,
}

#[contract]
pub struct OptionsAmmContract;

#[contractimpl]
impl OptionsAmmContract {
    /// Initialize the AMM
    pub fn initialize(
        env: Env,
        admin: Address,
        liquidity_token: Address,  // Token used for liquidity (XLM or stablecoin)
        settlement_token: Address, // Token for settlements
        oracle: Address,           // Price oracle
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::LiquidityToken, &liquidity_token);
        env.storage().instance().set(&DataKey::SettlementToken, &settlement_token);
        env.storage().instance().set(&DataKey::Oracle, &oracle);
        env.storage().instance().set(&DataKey::PoolCounter, &0u64);
        env.storage().instance().set(&DataKey::ActivePools, &Vec::<u64>::new(&env));
        env.storage().instance().set(&DataKey::TotalVolume, &0i128);
        env.storage().instance().set(&DataKey::ProtocolFees, &0i128);

        // Default pricing params
        let pricing = PricingParams {
            spot_price: 120_000, // $0.12 with 6 decimals
            risk_free_rate: 500, // 5%
            base_volatility: 6000, // 60%
        };
        env.storage().instance().set(&DataKey::PricingParams, &pricing);

        Ok(())
    }

    /// Create a new options pool for a strike/expiry
    pub fn create_pool(
        env: Env,
        creator: Address,
        strike_price: i128,
        expiration: u64,
        initial_call_liquidity: i128,
        initial_put_liquidity: i128,
        fee_rate: u32,
    ) -> Result<u64, Error> {
        creator.require_auth();

        if strike_price <= 0 {
            return Err(Error::InvalidStrike);
        }
        if initial_call_liquidity <= 0 || initial_put_liquidity <= 0 {
            return Err(Error::InvalidAmount);
        }

        let current_time = env.ledger().timestamp();
        if expiration <= current_time {
            return Err(Error::PoolExpired);
        }

        // Transfer liquidity from creator
        let liquidity_token: Address = env.storage().instance()
            .get(&DataKey::LiquidityToken)
            .ok_or(Error::NotInitialized)?;
        
        let token_client = TokenClient::new(&env, &liquidity_token);
        let total_liquidity = initial_call_liquidity + initial_put_liquidity;
        token_client.transfer(&creator, &env.current_contract_address(), &total_liquidity);

        // Get and increment pool counter
        let pool_id: u64 = env.storage().instance()
            .get(&DataKey::PoolCounter)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::PoolCounter, &(pool_id + 1));

        // Create pool
        let pool = OptionsPool {
            id: pool_id,
            call_liquidity: initial_call_liquidity,
            put_liquidity: initial_put_liquidity,
            strike_price,
            expiration,
            implied_volatility: 6000, // Default 60%
            total_lp_shares: total_liquidity, // 1:1 initial ratio
            fee_rate,
            is_active: true,
            created_at: current_time,
        };

        env.storage().persistent().set(&DataKey::Pool(pool_id), &pool);

        // Create LP position for creator
        let lp_position = LpPosition {
            pool_id,
            shares: total_liquidity,
            call_amount: initial_call_liquidity,
            put_amount: initial_put_liquidity,
            entry_time: current_time,
        };
        env.storage().persistent().set(&DataKey::UserLp(creator.clone(), pool_id), &lp_position);

        // Add to user's pools
        Self::add_user_pool(&env, &creator, pool_id);

        // Add to active pools
        let mut active: Vec<u64> = env.storage().instance()
            .get(&DataKey::ActivePools)
            .unwrap_or(Vec::new(&env));
        active.push_back(pool_id);
        env.storage().instance().set(&DataKey::ActivePools, &active);

        // Emit event
        env.events().publish(
            (symbol_short!("pool"), creator),
            (pool_id, strike_price, expiration),
        );

        log!(&env, "Pool {} created with strike {}", pool_id, strike_price);

        Ok(pool_id)
    }

    /// Add liquidity to an existing pool
    pub fn add_liquidity(
        env: Env,
        provider: Address,
        pool_id: u64,
        call_amount: i128,
        put_amount: i128,
    ) -> Result<i128, Error> {
        provider.require_auth();

        if call_amount <= 0 || put_amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut pool: OptionsPool = env.storage().persistent()
            .get(&DataKey::Pool(pool_id))
            .ok_or(Error::PoolNotFound)?;

        if !pool.is_active {
            return Err(Error::PoolInactive);
        }

        let current_time = env.ledger().timestamp();
        if pool.expiration <= current_time {
            return Err(Error::PoolExpired);
        }

        // Transfer liquidity
        let liquidity_token: Address = env.storage().instance()
            .get(&DataKey::LiquidityToken)
            .ok_or(Error::NotInitialized)?;
        
        let token_client = TokenClient::new(&env, &liquidity_token);
        let total_amount = call_amount + put_amount;
        token_client.transfer(&provider, &env.current_contract_address(), &total_amount);

        // Calculate LP shares to mint (proportional to existing pool)
        let total_pool_liquidity = pool.call_liquidity + pool.put_liquidity;
        let shares_to_mint = if pool.total_lp_shares == 0 {
            total_amount
        } else {
            (total_amount * pool.total_lp_shares) / total_pool_liquidity
        };

        // Update pool
        pool.call_liquidity += call_amount;
        pool.put_liquidity += put_amount;
        pool.total_lp_shares += shares_to_mint;
        env.storage().persistent().set(&DataKey::Pool(pool_id), &pool);

        // Update or create LP position
        let mut lp_position: LpPosition = env.storage().persistent()
            .get(&DataKey::UserLp(provider.clone(), pool_id))
            .unwrap_or(LpPosition {
                pool_id,
                shares: 0,
                call_amount: 0,
                put_amount: 0,
                entry_time: current_time,
            });
        
        lp_position.shares += shares_to_mint;
        lp_position.call_amount += call_amount;
        lp_position.put_amount += put_amount;
        env.storage().persistent().set(&DataKey::UserLp(provider.clone(), pool_id), &lp_position);

        Self::add_user_pool(&env, &provider, pool_id);

        // Emit event
        env.events().publish(
            (symbol_short!("addliq"), provider),
            (pool_id, shares_to_mint),
        );

        Ok(shares_to_mint)
    }

    /// Remove liquidity from a pool
    pub fn remove_liquidity(
        env: Env,
        provider: Address,
        pool_id: u64,
        shares_to_burn: i128,
    ) -> Result<(i128, i128), Error> {
        provider.require_auth();

        if shares_to_burn <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut pool: OptionsPool = env.storage().persistent()
            .get(&DataKey::Pool(pool_id))
            .ok_or(Error::PoolNotFound)?;

        let mut lp_position: LpPosition = env.storage().persistent()
            .get(&DataKey::UserLp(provider.clone(), pool_id))
            .ok_or(Error::InsufficientShares)?;

        if shares_to_burn > lp_position.shares {
            return Err(Error::InsufficientShares);
        }

        // Calculate amounts to return (proportional)
        let call_amount = (shares_to_burn * pool.call_liquidity) / pool.total_lp_shares;
        let put_amount = (shares_to_burn * pool.put_liquidity) / pool.total_lp_shares;

        // Transfer liquidity back
        let liquidity_token: Address = env.storage().instance()
            .get(&DataKey::LiquidityToken)
            .ok_or(Error::NotInitialized)?;
        
        let token_client = TokenClient::new(&env, &liquidity_token);
        let total_amount = call_amount + put_amount;
        token_client.transfer(&env.current_contract_address(), &provider, &total_amount);

        // Update pool
        pool.call_liquidity -= call_amount;
        pool.put_liquidity -= put_amount;
        pool.total_lp_shares -= shares_to_burn;
        env.storage().persistent().set(&DataKey::Pool(pool_id), &pool);

        // Update LP position
        lp_position.shares -= shares_to_burn;
        lp_position.call_amount -= call_amount;
        lp_position.put_amount -= put_amount;
        env.storage().persistent().set(&DataKey::UserLp(provider.clone(), pool_id), &lp_position);

        // Emit event
        env.events().publish(
            (symbol_short!("remliq"), provider),
            (pool_id, call_amount, put_amount),
        );

        Ok((call_amount, put_amount))
    }

    /// Buy an option from the AMM pool
    pub fn buy_option(
        env: Env,
        buyer: Address,
        pool_id: u64,
        is_call: bool,
        amount: i128,
        max_premium: i128,  // Slippage protection
    ) -> Result<i128, Error> {
        buyer.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut pool: OptionsPool = env.storage().persistent()
            .get(&DataKey::Pool(pool_id))
            .ok_or(Error::PoolNotFound)?;

        if !pool.is_active {
            return Err(Error::PoolInactive);
        }

        let current_time = env.ledger().timestamp();
        if pool.expiration <= current_time {
            return Err(Error::PoolExpired);
        }

        // Check liquidity
        let available_liquidity = if is_call { pool.call_liquidity } else { pool.put_liquidity };
        if amount > available_liquidity {
            return Err(Error::InsufficientLiquidity);
        }

        // Calculate premium using simplified Black-Scholes
        let premium = Self::calculate_premium(&env, &pool, is_call, amount)?;
        
        // Add trading fee
        let fee = (premium * pool.fee_rate as i128) / 10000;
        let total_cost = premium + fee;

        // Slippage check
        if total_cost > max_premium {
            return Err(Error::SlippageExceeded);
        }

        // Transfer payment from buyer
        let liquidity_token: Address = env.storage().instance()
            .get(&DataKey::LiquidityToken)
            .ok_or(Error::NotInitialized)?;
        
        let token_client = TokenClient::new(&env, &liquidity_token);
        token_client.transfer(&buyer, &env.current_contract_address(), &total_cost);

        // Update pool liquidity
        if is_call {
            pool.call_liquidity -= amount;
        } else {
            pool.put_liquidity -= amount;
        }

        // Update IV based on demand (simplified)
        pool.implied_volatility = Self::adjust_iv(pool.implied_volatility, true);
        
        env.storage().persistent().set(&DataKey::Pool(pool_id), &pool);

        // Track volume
        let total_volume: i128 = env.storage().instance()
            .get(&DataKey::TotalVolume)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalVolume, &(total_volume + amount));

        // Track protocol fees
        let protocol_fees: i128 = env.storage().instance()
            .get(&DataKey::ProtocolFees)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::ProtocolFees, &(protocol_fees + fee));

        // Emit event
        env.events().publish(
            (symbol_short!("buyopt"), buyer),
            (pool_id, is_call, amount, premium),
        );

        Ok(premium)
    }

    /// Sell an option back to the AMM pool
    pub fn sell_option(
        env: Env,
        seller: Address,
        pool_id: u64,
        is_call: bool,
        amount: i128,
        min_premium: i128,  // Slippage protection
    ) -> Result<i128, Error> {
        seller.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut pool: OptionsPool = env.storage().persistent()
            .get(&DataKey::Pool(pool_id))
            .ok_or(Error::PoolNotFound)?;

        if !pool.is_active {
            return Err(Error::PoolInactive);
        }

        let current_time = env.ledger().timestamp();
        if pool.expiration <= current_time {
            return Err(Error::PoolExpired);
        }

        // Calculate premium (slightly less than buy price - spread)
        let premium = Self::calculate_premium(&env, &pool, is_call, amount)?;
        let spread = (premium * 50) / 10000; // 0.5% spread
        let payout = premium - spread;

        // Slippage check
        if payout < min_premium {
            return Err(Error::SlippageExceeded);
        }

        // Transfer payout to seller
        let liquidity_token: Address = env.storage().instance()
            .get(&DataKey::LiquidityToken)
            .ok_or(Error::NotInitialized)?;
        
        let token_client = TokenClient::new(&env, &liquidity_token);
        token_client.transfer(&env.current_contract_address(), &seller, &payout);

        // Update pool liquidity
        if is_call {
            pool.call_liquidity += amount;
        } else {
            pool.put_liquidity += amount;
        }

        // Update IV based on supply (simplified)
        pool.implied_volatility = Self::adjust_iv(pool.implied_volatility, false);
        
        env.storage().persistent().set(&DataKey::Pool(pool_id), &pool);

        // Emit event
        env.events().publish(
            (symbol_short!("sellopt"), seller),
            (pool_id, is_call, amount, payout),
        );

        Ok(payout)
    }

    /// Get option quote without executing
    pub fn get_quote(
        env: Env,
        pool_id: u64,
        is_call: bool,
        amount: i128,
    ) -> Result<i128, Error> {
        let pool: OptionsPool = env.storage().persistent()
            .get(&DataKey::Pool(pool_id))
            .ok_or(Error::PoolNotFound)?;
        
        Self::calculate_premium(&env, &pool, is_call, amount)
    }

    /// Get pool details
    pub fn get_pool(env: Env, pool_id: u64) -> Result<OptionsPool, Error> {
        env.storage().persistent()
            .get(&DataKey::Pool(pool_id))
            .ok_or(Error::PoolNotFound)
    }

    /// Get all active pools
    pub fn get_active_pools(env: Env) -> Vec<OptionsPool> {
        let active_ids: Vec<u64> = env.storage().instance()
            .get(&DataKey::ActivePools)
            .unwrap_or(Vec::new(&env));
        
        let mut pools = Vec::new(&env);
        let current_time = env.ledger().timestamp();

        for id in active_ids.iter() {
            if let Some(pool) = env.storage().persistent().get::<_, OptionsPool>(&DataKey::Pool(id)) {
                if pool.is_active && pool.expiration > current_time {
                    pools.push_back(pool);
                }
            }
        }

        pools
    }

    /// Get user's LP position in a pool
    pub fn get_lp_position(env: Env, user: Address, pool_id: u64) -> Result<LpPosition, Error> {
        env.storage().persistent()
            .get(&DataKey::UserLp(user, pool_id))
            .ok_or(Error::InsufficientShares)
    }

    /// Get pools user has provided liquidity to
    pub fn get_user_pools(env: Env, user: Address) -> Vec<u64> {
        env.storage().persistent()
            .get(&DataKey::UserPools(user))
            .unwrap_or(Vec::new(&env))
    }

    /// Get total trading volume
    pub fn get_total_volume(env: Env) -> i128 {
        env.storage().instance()
            .get(&DataKey::TotalVolume)
            .unwrap_or(0)
    }

    /// Get accumulated protocol fees
    pub fn get_protocol_fees(env: Env) -> i128 {
        env.storage().instance()
            .get(&DataKey::ProtocolFees)
            .unwrap_or(0)
    }

    /// Update pricing parameters (admin only)
    pub fn update_pricing(
        env: Env,
        admin: Address,
        spot_price: i128,
        risk_free_rate: u32,
        base_volatility: u32,
    ) -> Result<(), Error> {
        admin.require_auth();

        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        
        if admin != stored_admin {
            return Err(Error::Unauthorized);
        }

        let pricing = PricingParams {
            spot_price,
            risk_free_rate,
            base_volatility,
        };
        env.storage().instance().set(&DataKey::PricingParams, &pricing);

        Ok(())
    }

    // === Helper Functions ===

    fn add_user_pool(env: &Env, user: &Address, pool_id: u64) {
        let mut user_pools: Vec<u64> = env.storage().persistent()
            .get(&DataKey::UserPools(user.clone()))
            .unwrap_or(Vec::new(env));
        
        // Check if pool already tracked
        let mut found = false;
        for id in user_pools.iter() {
            if id == pool_id {
                found = true;
                break;
            }
        }
        
        if !found {
            user_pools.push_back(pool_id);
            env.storage().persistent().set(&DataKey::UserPools(user.clone()), &user_pools);
        }
    }

    /// Simplified Black-Scholes approximation for on-chain computation
    fn calculate_premium(
        env: &Env,
        pool: &OptionsPool,
        is_call: bool,
        amount: i128,
    ) -> Result<i128, Error> {
        let pricing: PricingParams = env.storage().instance()
            .get(&DataKey::PricingParams)
            .ok_or(Error::NotInitialized)?;

        let current_time = env.ledger().timestamp();
        let time_to_expiry = pool.expiration.saturating_sub(current_time);
        
        // Convert to years (approximate, 365 days = 31536000 seconds)
        let t_years = (time_to_expiry as i128 * 10000) / 31536000;
        
        // Simplified pricing factors
        let spot = pricing.spot_price;
        let strike = pool.strike_price;
        let iv = pool.implied_volatility as i128;
        
        // Intrinsic value
        let intrinsic = if is_call {
            if spot > strike { spot - strike } else { 0 }
        } else {
            if strike > spot { strike - spot } else { 0 }
        };
        
        // Time value (simplified - proportional to IV and sqrt(time))
        // Using approximation: time_value = 0.4 * S * IV * sqrt(T)
        let sqrt_t = Self::int_sqrt(t_years);
        let time_value = (spot * iv * sqrt_t) / (100 * 100 * 100);
        
        // Total premium per unit
        let premium_per_unit = intrinsic + time_value;
        
        // Total for amount
        let total_premium = (premium_per_unit * amount) / 1_000_000; // Adjust for decimals
        
        Ok(total_premium.max(1)) // Minimum 1 unit premium
    }

    /// Integer square root approximation
    fn int_sqrt(n: i128) -> i128 {
        if n <= 0 {
            return 0;
        }
        let mut x = n;
        let mut y = (x + 1) / 2;
        while y < x {
            x = y;
            y = (x + n / x) / 2;
        }
        x
    }

    /// Adjust IV based on trading activity
    fn adjust_iv(current_iv: u32, is_buy: bool) -> u32 {
        let adjustment = 10; // 0.1% adjustment
        if is_buy {
            current_iv.saturating_add(adjustment).min(20000) // Cap at 200%
        } else {
            current_iv.saturating_sub(adjustment).max(1000) // Floor at 10%
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register_contract(None, OptionsAmmContract);
        let client = OptionsAmmContractClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        let liquidity_token = Address::generate(&env);
        let settlement_token = Address::generate(&env);
        let oracle = Address::generate(&env);

        client.initialize(&admin, &liquidity_token, &settlement_token, &oracle);
        
        assert_eq!(client.get_total_volume(), 0);
        assert_eq!(client.get_protocol_fees(), 0);
    }
}
