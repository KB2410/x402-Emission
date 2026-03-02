#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    symbol_short, Address, Env, Vec, log,
};

/// Option series template for standardized options
#[contracttype]
#[derive(Clone, Debug)]
pub struct OptionSeries {
    pub id: u64,
    pub name: soroban_sdk::String,
    pub strike_prices: Vec<i128>,      // Multiple strike prices
    pub expiration: u64,               // Expiration timestamp
    pub emission_period_start: u64,
    pub emission_period_end: u64,
    pub underlying_amount: i128,       // Standard lot size
    pub is_active: bool,
    pub created_by: Address,
    pub created_at: u64,
}

/// Storage keys
#[contracttype]
pub enum DataKey {
    Admin,
    EmissionOptionContract,
    SeriesCounter,
    Series(u64),
    ActiveSeries,
    SeriesByExpiry(u64),
}

/// Contract errors
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    SeriesNotFound = 4,
    SeriesInactive = 5,
    InvalidExpiration = 6,
    InvalidStrikePrices = 7,
}

#[contract]
pub struct OptionsFactoryContract;

#[contractimpl]
impl OptionsFactoryContract {
    /// Initialize the factory with admin and emission option contract
    pub fn initialize(
        env: Env,
        admin: Address,
        emission_option_contract: Address,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::EmissionOptionContract, &emission_option_contract);
        env.storage().instance().set(&DataKey::SeriesCounter, &0u64);
        env.storage().instance().set(&DataKey::ActiveSeries, &Vec::<u64>::new(&env));

        Ok(())
    }

    /// Create a new option series with multiple strike prices
    pub fn create_series(
        env: Env,
        creator: Address,
        name: soroban_sdk::String,
        strike_prices: Vec<i128>,
        expiration: u64,
        emission_period_start: u64,
        emission_period_end: u64,
        underlying_amount: i128,
    ) -> Result<u64, Error> {
        creator.require_auth();

        // Validate inputs
        let current_time = env.ledger().timestamp();
        if expiration <= current_time {
            return Err(Error::InvalidExpiration);
        }
        
        if strike_prices.is_empty() {
            return Err(Error::InvalidStrikePrices);
        }

        // Get and increment series counter
        let series_id: u64 = env.storage().instance()
            .get(&DataKey::SeriesCounter)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::SeriesCounter, &(series_id + 1));

        // Create series
        let series = OptionSeries {
            id: series_id,
            name,
            strike_prices,
            expiration,
            emission_period_start,
            emission_period_end,
            underlying_amount,
            is_active: true,
            created_by: creator.clone(),
            created_at: current_time,
        };

        // Store series
        env.storage().persistent().set(&DataKey::Series(series_id), &series);

        // Add to active series
        let mut active: Vec<u64> = env.storage().instance()
            .get(&DataKey::ActiveSeries)
            .unwrap_or(Vec::new(&env));
        active.push_back(series_id);
        env.storage().instance().set(&DataKey::ActiveSeries, &active);

        // Index by expiry
        let mut by_expiry: Vec<u64> = env.storage().persistent()
            .get(&DataKey::SeriesByExpiry(expiration))
            .unwrap_or(Vec::new(&env));
        by_expiry.push_back(series_id);
        env.storage().persistent().set(&DataKey::SeriesByExpiry(expiration), &by_expiry);

        // Emit event
        env.events().publish(
            (symbol_short!("series"), creator),
            series_id,
        );

        log!(&env, "Option series {} created", series_id);

        Ok(series_id)
    }

    /// Get series details
    pub fn get_series(env: Env, series_id: u64) -> Result<OptionSeries, Error> {
        env.storage().persistent()
            .get(&DataKey::Series(series_id))
            .ok_or(Error::SeriesNotFound)
    }

    /// Get all active series
    pub fn get_active_series(env: Env) -> Vec<OptionSeries> {
        let active_ids: Vec<u64> = env.storage().instance()
            .get(&DataKey::ActiveSeries)
            .unwrap_or(Vec::new(&env));
        
        let mut series_list = Vec::new(&env);
        let current_time = env.ledger().timestamp();

        for id in active_ids.iter() {
            if let Some(series) = env.storage().persistent().get::<_, OptionSeries>(&DataKey::Series(id)) {
                if series.is_active && series.expiration > current_time {
                    series_list.push_back(series);
                }
            }
        }

        series_list
    }

    /// Get series by expiration date
    pub fn get_series_by_expiry(env: Env, expiration: u64) -> Vec<OptionSeries> {
        let series_ids: Vec<u64> = env.storage().persistent()
            .get(&DataKey::SeriesByExpiry(expiration))
            .unwrap_or(Vec::new(&env));
        
        let mut series_list = Vec::new(&env);

        for id in series_ids.iter() {
            if let Some(series) = env.storage().persistent().get::<_, OptionSeries>(&DataKey::Series(id)) {
                series_list.push_back(series);
            }
        }

        series_list
    }

    /// Deactivate a series (admin or creator only)
    pub fn deactivate_series(env: Env, caller: Address, series_id: u64) -> Result<(), Error> {
        caller.require_auth();

        let mut series: OptionSeries = env.storage().persistent()
            .get(&DataKey::Series(series_id))
            .ok_or(Error::SeriesNotFound)?;

        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;

        if caller != admin && caller != series.created_by {
            return Err(Error::Unauthorized);
        }

        series.is_active = false;
        env.storage().persistent().set(&DataKey::Series(series_id), &series);

        // Emit event
        env.events().publish(
            (symbol_short!("deact"), caller),
            series_id,
        );

        Ok(())
    }

    /// Get total number of series created
    pub fn get_series_count(env: Env) -> u64 {
        env.storage().instance()
            .get(&DataKey::SeriesCounter)
            .unwrap_or(0)
    }

    /// Get emission option contract address
    pub fn get_emission_option_contract(env: Env) -> Result<Address, Error> {
        env.storage().instance()
            .get(&DataKey::EmissionOptionContract)
            .ok_or(Error::NotInitialized)
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
        
        let contract_id = env.register_contract(None, OptionsFactoryContract);
        let client = OptionsFactoryContractClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        let emission_contract = Address::generate(&env);

        client.initialize(&admin, &emission_contract);
        
        assert_eq!(client.get_series_count(), 0);
    }
}
