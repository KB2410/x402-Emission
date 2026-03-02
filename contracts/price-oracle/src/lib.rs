#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    symbol_short, Address, Env, Map, log,
};

/// Price data structure
#[contracttype]
#[derive(Clone, Debug)]
pub struct PriceData {
    pub price: i128,           // Price in 6 decimals (e.g., 120000 = $0.12)
    pub timestamp: u64,        // Unix timestamp
    pub confidence: u32,       // Confidence interval in basis points
    pub source: Address,       // Price feed source
}

/// Supported assets
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Asset {
    XLM,
    USDC,
    X402,
}

/// Storage keys
#[contracttype]
pub enum DataKey {
    Admin,
    PriceFeeder(Address),
    LatestPrice(Asset),
    PriceHistory(Asset, u64),  // Asset -> Timestamp
    MaxPriceAge,               // Maximum age for valid prices (seconds)
    MinConfidence,             // Minimum confidence threshold
    EmergencyPrice(Asset),     // Emergency fallback prices
}

/// Contract errors
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    InvalidPrice = 4,
    PriceStale = 5,
    LowConfidence = 6,
    AssetNotSupported = 7,
    InvalidTimestamp = 8,
    PriceFeederNotAuthorized = 9,
}

#[contract]
pub struct PriceOracleContract;

#[contractimpl]
impl PriceOracleContract {
    /// Initialize the oracle
    pub fn initialize(
        env: Env,
        admin: Address,
        max_price_age: u64,      // Maximum age in seconds (e.g., 3600 = 1 hour)
        min_confidence: u32,     // Minimum confidence in basis points (e.g., 9500 = 95%)
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::MaxPriceAge, &max_price_age);
        env.storage().instance().set(&DataKey::MinConfidence, &min_confidence);

        log!(&env, "PriceOracle initialized by admin: {}", admin);
        Ok(())
    }

    /// Add authorized price feeder
    pub fn add_price_feeder(env: Env, feeder: Address) -> Result<(), Error> {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        
        admin.require_auth();
        
        env.storage().persistent().set(&DataKey::PriceFeeder(feeder.clone()), &true);
        
        log!(&env, "Price feeder added: {}", feeder);
        Ok(())
    }

    /// Remove price feeder authorization
    pub fn remove_price_feeder(env: Env, feeder: Address) -> Result<(), Error> {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        
        admin.require_auth();
        
        env.storage().persistent().remove(&DataKey::PriceFeeder(feeder.clone()));
        
        log!(&env, "Price feeder removed: {}", feeder);
        Ok(())
    }

    /// Submit price update (only authorized feeders)
    pub fn update_price(
        env: Env,
        asset: Asset,
        price: i128,
        confidence: u32,
    ) -> Result<(), Error> {
        let feeder = env.current_contract_address(); // In production, get from auth context
        
        // Check if feeder is authorized
        if !env.storage().persistent().has(&DataKey::PriceFeeder(feeder.clone())) {
            return Err(Error::PriceFeederNotAuthorized);
        }

        // Validate price
        if price <= 0 {
            return Err(Error::InvalidPrice);
        }

        // Check minimum confidence
        let min_confidence: u32 = env.storage().instance()
            .get(&DataKey::MinConfidence)
            .unwrap_or(9000); // Default 90%
        
        if confidence < min_confidence {
            return Err(Error::LowConfidence);
        }

        let timestamp = env.ledger().timestamp();
        
        let price_data = PriceData {
            price,
            timestamp,
            confidence,
            source: feeder,
        };

        // Store latest price
        env.storage().persistent().set(&DataKey::LatestPrice(asset.clone()), &price_data);
        
        // Store in history (for TWAP calculations)
        env.storage().temporary().set(
            &DataKey::PriceHistory(asset.clone(), timestamp), 
            &price_data
        );

        log!(&env, "Price updated for {:?}: {} at {}", asset, price, timestamp);
        Ok(())
    }

    /// Get latest price for an asset
    pub fn get_price(env: Env, asset: Asset) -> Result<PriceData, Error> {
        let price_data: PriceData = env.storage().persistent()
            .get(&DataKey::LatestPrice(asset.clone()))
            .ok_or(Error::AssetNotSupported)?;

        // Check if price is stale
        let max_age: u64 = env.storage().instance()
            .get(&DataKey::MaxPriceAge)
            .unwrap_or(3600); // Default 1 hour

        let current_time = env.ledger().timestamp();
        if current_time - price_data.timestamp > max_age {
            return Err(Error::PriceStale);
        }

        Ok(price_data)
    }

    /// Get price with staleness check disabled (for emergency situations)
    pub fn get_price_unsafe(env: Env, asset: Asset) -> Result<PriceData, Error> {
        env.storage().persistent()
            .get(&DataKey::LatestPrice(asset))
            .ok_or(Error::AssetNotSupported)
    }

    /// Set emergency fallback price (admin only)
    pub fn set_emergency_price(
        env: Env,
        asset: Asset,
        price: i128,
    ) -> Result<(), Error> {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        
        admin.require_auth();

        if price <= 0 {
            return Err(Error::InvalidPrice);
        }

        env.storage().persistent().set(&DataKey::EmergencyPrice(asset.clone()), &price);
        
        log!(&env, "Emergency price set for {:?}: {}", asset, price);
        Ok(())
    }

    /// Get emergency price (used when oracle fails)
    pub fn get_emergency_price(env: Env, asset: Asset) -> Result<i128, Error> {
        env.storage().persistent()
            .get(&DataKey::EmergencyPrice(asset))
            .ok_or(Error::AssetNotSupported)
    }

    /// Calculate Time-Weighted Average Price (TWAP)
    pub fn get_twap(
        env: Env,
        asset: Asset,
        duration: u64,  // Duration in seconds
    ) -> Result<i128, Error> {
        let current_time = env.ledger().timestamp();
        let start_time = current_time.saturating_sub(duration);
        
        let mut total_weighted_price = 0i128;
        let mut total_weight = 0u64;
        let mut last_timestamp = start_time;
        let mut last_price = 0i128;

        // This is a simplified TWAP calculation
        // In production, you'd iterate through stored price points
        
        // For now, return latest price if no historical data
        let latest = Self::get_price(env.clone(), asset)?;
        Ok(latest.price)
    }

    /// Check if price is valid and fresh
    pub fn is_price_valid(env: Env, asset: Asset) -> bool {
        match Self::get_price(env, asset) {
            Ok(_) => true,
            Err(_) => false,
        }
    }

    /// Get oracle configuration
    pub fn get_config(env: Env) -> Result<(u64, u32), Error> {
        let max_age: u64 = env.storage().instance()
            .get(&DataKey::MaxPriceAge)
            .ok_or(Error::NotInitialized)?;
        
        let min_confidence: u32 = env.storage().instance()
            .get(&DataKey::MinConfidence)
            .ok_or(Error::NotInitialized)?;

        Ok((max_age, min_confidence))
    }

    /// Update oracle configuration (admin only)
    pub fn update_config(
        env: Env,
        max_price_age: u64,
        min_confidence: u32,
    ) -> Result<(), Error> {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        
        admin.require_auth();

        env.storage().instance().set(&DataKey::MaxPriceAge, &max_price_age);
        env.storage().instance().set(&DataKey::MinConfidence, &min_confidence);

        log!(&env, "Oracle config updated: max_age={}, min_confidence={}", 
             max_price_age, min_confidence);
        Ok(())
    }
}