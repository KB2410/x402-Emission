#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    symbol_short, Address, Env, Vec, log,
    token::TokenClient,
};

/// Settlement type
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SettlementType {
    Cash,      // Settle in stablecoin/XLM
    Physical,  // Deliver actual emissions/tokens
}

/// Settlement record
#[contracttype]
#[derive(Clone, Debug)]
pub struct Settlement {
    pub id: u64,
    pub option_id: u64,
    pub settlement_type: SettlementType,
    pub settlement_price: i128,   // Final settlement price
    pub payout_amount: i128,      // Amount paid to holder
    pub settled_at: u64,
    pub settled_by: Address,
}

/// Price data from oracle
#[contracttype]
#[derive(Clone, Debug)]
pub struct PriceData {
    pub price: i128,       // Price with 6 decimals
    pub timestamp: u64,
    pub source: Address,   // Oracle address
}

/// Storage keys
#[contracttype]
pub enum DataKey {
    Admin,
    EmissionOptionContract,
    Oracle,
    SettlementToken,
    EmissionToken,
    Settlement(u64),
    SettlementCounter,
    PendingSettlements,
    SettlementsByOption(u64),
    LastPrice,
    AutoSettleEnabled,
}

/// Contract errors
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    OptionNotFound = 4,
    OptionNotExpired = 5,
    AlreadySettled = 6,
    OracleError = 7,
    InvalidPrice = 8,
    SettlementFailed = 9,
    InsufficientFunds = 10,
}

#[contract]
pub struct SettlementEngineContract;

#[contractimpl]
impl SettlementEngineContract {
    /// Initialize the settlement engine
    pub fn initialize(
        env: Env,
        admin: Address,
        emission_option_contract: Address,
        oracle: Address,
        settlement_token: Address,
        emission_token: Address,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::EmissionOptionContract, &emission_option_contract);
        env.storage().instance().set(&DataKey::Oracle, &oracle);
        env.storage().instance().set(&DataKey::SettlementToken, &settlement_token);
        env.storage().instance().set(&DataKey::EmissionToken, &emission_token);
        env.storage().instance().set(&DataKey::SettlementCounter, &0u64);
        env.storage().instance().set(&DataKey::PendingSettlements, &Vec::<u64>::new(&env));
        env.storage().instance().set(&DataKey::AutoSettleEnabled, &true);

        Ok(())
    }

    /// Update price from oracle (can be called by anyone, validated by oracle)
    pub fn update_price(
        env: Env,
        caller: Address,
        price: i128,
    ) -> Result<(), Error> {
        caller.require_auth();

        if price <= 0 {
            return Err(Error::InvalidPrice);
        }

        // In production, verify caller is the oracle
        let oracle: Address = env.storage().instance()
            .get(&DataKey::Oracle)
            .ok_or(Error::NotInitialized)?;

        // For MVP, allow admin or oracle to update
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;

        if caller != admin && caller != oracle {
            return Err(Error::Unauthorized);
        }

        let price_data = PriceData {
            price,
            timestamp: env.ledger().timestamp(),
            source: caller.clone(),
        };

        env.storage().instance().set(&DataKey::LastPrice, &price_data);

        // Emit event
        env.events().publish(
            (symbol_short!("price"), caller),
            (price, env.ledger().timestamp()),
        );

        Ok(())
    }

    /// Settle an expired option with cash settlement
    pub fn settle_cash(
        env: Env,
        caller: Address,
        option_id: u64,
        option_type_is_call: bool,
        strike_price: i128,
        underlying_amount: i128,
        holder: Address,
        writer: Address,
    ) -> Result<u64, Error> {
        caller.require_auth();

        // Get current price
        let price_data: PriceData = env.storage().instance()
            .get(&DataKey::LastPrice)
            .ok_or(Error::OracleError)?;

        let settlement_price = price_data.price;
        
        // Calculate payout
        let payout = Self::calculate_cash_payout(
            option_type_is_call,
            strike_price,
            settlement_price,
            underlying_amount,
        );

        if payout > 0 {
            // Transfer payout to holder
            let settlement_token: Address = env.storage().instance()
                .get(&DataKey::SettlementToken)
                .ok_or(Error::NotInitialized)?;
            
            let token_client = TokenClient::new(&env, &settlement_token);
            
            // In production, funds would come from collateral
            // For MVP, assuming contract has funds or writer transfers
            token_client.transfer(&writer, &holder, &payout);
        }

        // Create settlement record
        let settlement_id: u64 = env.storage().instance()
            .get(&DataKey::SettlementCounter)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::SettlementCounter, &(settlement_id + 1));

        let settlement = Settlement {
            id: settlement_id,
            option_id,
            settlement_type: SettlementType::Cash,
            settlement_price,
            payout_amount: payout,
            settled_at: env.ledger().timestamp(),
            settled_by: caller.clone(),
        };

        env.storage().persistent().set(&DataKey::Settlement(settlement_id), &settlement);

        // Index by option
        let mut option_settlements: Vec<u64> = env.storage().persistent()
            .get(&DataKey::SettlementsByOption(option_id))
            .unwrap_or(Vec::new(&env));
        option_settlements.push_back(settlement_id);
        env.storage().persistent().set(&DataKey::SettlementsByOption(option_id), &option_settlements);

        // Emit event
        env.events().publish(
            (symbol_short!("settle"), caller),
            (settlement_id, option_id, payout),
        );

        log!(&env, "Option {} settled with payout {}", option_id, payout);

        Ok(settlement_id)
    }

    /// Settle an expired option with physical delivery (emissions)
    pub fn settle_physical(
        env: Env,
        caller: Address,
        option_id: u64,
        option_type_is_call: bool,
        strike_price: i128,
        underlying_amount: i128,
        holder: Address,
        writer: Address,
    ) -> Result<u64, Error> {
        caller.require_auth();

        // Get current price
        let price_data: PriceData = env.storage().instance()
            .get(&DataKey::LastPrice)
            .ok_or(Error::OracleError)?;

        let settlement_price = price_data.price;
        
        // Check if option is in the money
        let is_itm = if option_type_is_call {
            settlement_price > strike_price
        } else {
            settlement_price < strike_price
        };

        if !is_itm {
            // Option expired worthless - no physical delivery
            return Self::record_expired_settlement(&env, caller, option_id, settlement_price);
        }

        let emission_token: Address = env.storage().instance()
            .get(&DataKey::EmissionToken)
            .ok_or(Error::NotInitialized)?;
        let settlement_token: Address = env.storage().instance()
            .get(&DataKey::SettlementToken)
            .ok_or(Error::NotInitialized)?;

        let emission_client = TokenClient::new(&env, &emission_token);
        let settlement_client = TokenClient::new(&env, &settlement_token);

        if option_type_is_call {
            // Call: Holder pays strike, receives emissions
            let strike_payment = (strike_price * underlying_amount) / 1_000_000;
            settlement_client.transfer(&holder, &writer, &strike_payment);
            emission_client.transfer(&writer, &holder, &underlying_amount);
        } else {
            // Put: Holder delivers emissions, receives strike
            emission_client.transfer(&holder, &writer, &underlying_amount);
            let strike_payment = (strike_price * underlying_amount) / 1_000_000;
            settlement_client.transfer(&writer, &holder, &strike_payment);
        }

        // Create settlement record
        let settlement_id: u64 = env.storage().instance()
            .get(&DataKey::SettlementCounter)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::SettlementCounter, &(settlement_id + 1));

        let settlement = Settlement {
            id: settlement_id,
            option_id,
            settlement_type: SettlementType::Physical,
            settlement_price,
            payout_amount: underlying_amount,
            settled_at: env.ledger().timestamp(),
            settled_by: caller.clone(),
        };

        env.storage().persistent().set(&DataKey::Settlement(settlement_id), &settlement);

        // Index by option
        let mut option_settlements: Vec<u64> = env.storage().persistent()
            .get(&DataKey::SettlementsByOption(option_id))
            .unwrap_or(Vec::new(&env));
        option_settlements.push_back(settlement_id);
        env.storage().persistent().set(&DataKey::SettlementsByOption(option_id), &option_settlements);

        // Emit event
        env.events().publish(
            (symbol_short!("physetl"), caller),
            (settlement_id, option_id, underlying_amount),
        );

        log!(&env, "Option {} physically settled", option_id);

        Ok(settlement_id)
    }

    /// Get settlement details
    pub fn get_settlement(env: Env, settlement_id: u64) -> Result<Settlement, Error> {
        env.storage().persistent()
            .get(&DataKey::Settlement(settlement_id))
            .ok_or(Error::OptionNotFound)
    }

    /// Get settlements for an option
    pub fn get_option_settlements(env: Env, option_id: u64) -> Vec<u64> {
        env.storage().persistent()
            .get(&DataKey::SettlementsByOption(option_id))
            .unwrap_or(Vec::new(&env))
    }

    /// Get last price data
    pub fn get_last_price(env: Env) -> Result<PriceData, Error> {
        env.storage().instance()
            .get(&DataKey::LastPrice)
            .ok_or(Error::OracleError)
    }

    /// Get total number of settlements
    pub fn get_settlement_count(env: Env) -> u64 {
        env.storage().instance()
            .get(&DataKey::SettlementCounter)
            .unwrap_or(0)
    }

    /// Enable/disable auto settlement (admin only)
    pub fn set_auto_settle(env: Env, admin: Address, enabled: bool) -> Result<(), Error> {
        admin.require_auth();

        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        
        if admin != stored_admin {
            return Err(Error::Unauthorized);
        }

        env.storage().instance().set(&DataKey::AutoSettleEnabled, &enabled);
        Ok(())
    }

    /// Update oracle address (admin only)
    pub fn set_oracle(env: Env, admin: Address, new_oracle: Address) -> Result<(), Error> {
        admin.require_auth();

        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        
        if admin != stored_admin {
            return Err(Error::Unauthorized);
        }

        env.storage().instance().set(&DataKey::Oracle, &new_oracle);
        Ok(())
    }

    // === Helper Functions ===

    fn calculate_cash_payout(
        is_call: bool,
        strike_price: i128,
        settlement_price: i128,
        underlying_amount: i128,
    ) -> i128 {
        if is_call {
            // Call: payout = max(0, settlement - strike) * amount
            if settlement_price > strike_price {
                ((settlement_price - strike_price) * underlying_amount) / 1_000_000
            } else {
                0
            }
        } else {
            // Put: payout = max(0, strike - settlement) * amount
            if strike_price > settlement_price {
                ((strike_price - settlement_price) * underlying_amount) / 1_000_000
            } else {
                0
            }
        }
    }

    fn record_expired_settlement(
        env: &Env,
        caller: Address,
        option_id: u64,
        settlement_price: i128,
    ) -> Result<u64, Error> {
        let settlement_id: u64 = env.storage().instance()
            .get(&DataKey::SettlementCounter)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::SettlementCounter, &(settlement_id + 1));

        let settlement = Settlement {
            id: settlement_id,
            option_id,
            settlement_type: SettlementType::Cash,
            settlement_price,
            payout_amount: 0,  // Expired worthless
            settled_at: env.ledger().timestamp(),
            settled_by: caller.clone(),
        };

        env.storage().persistent().set(&DataKey::Settlement(settlement_id), &settlement);

        // Emit event
        env.events().publish(
            (symbol_short!("expire"), caller),
            (settlement_id, option_id),
        );

        Ok(settlement_id)
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
        
        let contract_id = env.register_contract(None, SettlementEngineContract);
        let client = SettlementEngineContractClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        let emission_option = Address::generate(&env);
        let oracle = Address::generate(&env);
        let settlement_token = Address::generate(&env);
        let emission_token = Address::generate(&env);

        client.initialize(&admin, &emission_option, &oracle, &settlement_token, &emission_token);
        
        assert_eq!(client.get_settlement_count(), 0);
    }

    #[test]
    fn test_cash_payout_calculation() {
        // Call ITM
        assert_eq!(
            SettlementEngineContract::calculate_cash_payout(true, 100_000, 120_000, 1_000_000),
            20 // (120 - 100) * 1 = 20
        );
        
        // Call OTM
        assert_eq!(
            SettlementEngineContract::calculate_cash_payout(true, 120_000, 100_000, 1_000_000),
            0
        );

        // Put ITM
        assert_eq!(
            SettlementEngineContract::calculate_cash_payout(false, 120_000, 100_000, 1_000_000),
            20 // (120 - 100) * 1 = 20
        );

        // Put OTM
        assert_eq!(
            SettlementEngineContract::calculate_cash_payout(false, 100_000, 120_000, 1_000_000),
            0
        );
    }
}
