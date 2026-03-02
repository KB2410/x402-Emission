#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, 
    symbol_short, Address, Env, Map, Symbol, Vec, log,
    token::TokenClient,
};

/// Option type - Call or Put
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum OptionType {
    Call,
    Put,
}

/// Option status tracking
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum OptionStatus {
    Open,       // Available for purchase
    Active,     // Purchased, awaiting expiry
    Exercised,  // Option was exercised
    Expired,    // Option expired worthless
    Settled,    // Settlement completed
}

/// Core emission option structure
#[contracttype]
#[derive(Clone, Debug)]
pub struct EmissionOption {
    pub id: u64,
    pub option_type: OptionType,
    pub strike_price: i128,           // Strike price in stroops (1 XLM = 10^7 stroops)
    pub expiration: u64,              // Unix timestamp
    pub emission_period_start: u64,   // Start of emission period covered
    pub emission_period_end: u64,     // End of emission period covered
    pub underlying_amount: i128,      // X402 emissions covered (in stroops)
    pub premium: i128,                // Option premium in XLM stroops
    pub collateral_amount: i128,      // Collateral locked
    pub writer: Address,              // Option writer address
    pub buyer: Option<Address>,       // Option buyer (None if not purchased)
    pub status: OptionStatus,
    pub created_at: u64,
}

/// Storage keys
#[contracttype]
pub enum DataKey {
    Admin,
    OptionCounter,
    Option(u64),
    UserOptions(Address),
    CollateralToken,
    SettlementToken,
    EmissionToken,
    TotalCollateral,
    ProtocolFee,      // Fee in basis points (100 = 1%)
    TreasuryAddress,
    CollateralManager, // Address of CollateralManager contract
    RiskManager,       // Address of RiskManager contract
    SettlementEngine,  // Address of SettlementEngine contract
}

/// Contract errors
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    InvalidOption = 4,
    OptionNotFound = 5,
    OptionAlreadyPurchased = 6,
    OptionExpired = 7,
    OptionNotExpired = 8,
    InsufficientCollateral = 9,
    InsufficientPayment = 10,
    InvalidAmount = 11,
    InvalidStrikePrice = 12,
    InvalidExpiration = 13,
    CannotExercise = 14,
    AlreadySettled = 15,
    TransferFailed = 16,
}

#[contract]
pub struct EmissionOptionContract;

#[contractimpl]
impl EmissionOptionContract {
    /// Initialize the contract with admin and token addresses
    pub fn initialize(
        env: Env,
        admin: Address,
        collateral_token: Address,  // X402 token
        settlement_token: Address,  // XLM or stablecoin
        emission_token: Address,    // Token representing emissions
        protocol_fee: u32,          // Fee in basis points
        treasury: Address,
        collateral_manager: Address, // CollateralManager contract
        risk_manager: Address,       // RiskManager contract
        settlement_engine: Address,  // SettlementEngine contract
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::CollateralToken, &collateral_token);
        env.storage().instance().set(&DataKey::SettlementToken, &settlement_token);
        env.storage().instance().set(&DataKey::EmissionToken, &emission_token);
        env.storage().instance().set(&DataKey::ProtocolFee, &protocol_fee);
        env.storage().instance().set(&DataKey::TreasuryAddress, &treasury);
        env.storage().instance().set(&DataKey::CollateralManager, &collateral_manager);
        env.storage().instance().set(&DataKey::RiskManager, &risk_manager);
        env.storage().instance().set(&DataKey::SettlementEngine, &settlement_engine);
        env.storage().instance().set(&DataKey::OptionCounter, &0u64);
        env.storage().instance().set(&DataKey::TotalCollateral, &0i128);

        Ok(())
    }

    /// Write a new option (create and offer for sale)
    pub fn write_option(
        env: Env,
        writer: Address,
        option_type: OptionType,
        strike_price: i128,
        expiration: u64,
        emission_period_start: u64,
        emission_period_end: u64,
        underlying_amount: i128,
        premium: i128,
        collateral_amount: i128,
    ) -> Result<u64, Error> {
        writer.require_auth();

        // Validate inputs
        if strike_price <= 0 {
            return Err(Error::InvalidStrikePrice);
        }
        if underlying_amount <= 0 || premium <= 0 || collateral_amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        
        let current_time = env.ledger().timestamp();
        if expiration <= current_time {
            return Err(Error::InvalidExpiration);
        }

        // Lock collateral through CollateralManager instead of direct transfer
        let collateral_manager: Address = env.storage().instance()
            .get(&DataKey::CollateralManager)
            .ok_or(Error::NotInitialized)?;

        // Call CollateralManager to lock collateral
        // In production, this would be a cross-contract call
        // For now, we'll do direct transfer as fallback
        let collateral_token: Address = env.storage().instance()
            .get(&DataKey::CollateralToken)
            .ok_or(Error::NotInitialized)?;
        
        let token_client = TokenClient::new(&env, &collateral_token);
        token_client.transfer(&writer, &env.current_contract_address(), &collateral_amount);

        // Update total collateral
        let total_collateral: i128 = env.storage().instance()
            .get(&DataKey::TotalCollateral)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalCollateral, &(total_collateral + collateral_amount));

        // Get and increment option counter
        let option_id: u64 = env.storage().instance()
            .get(&DataKey::OptionCounter)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::OptionCounter, &(option_id + 1));

        // Create option
        let option = EmissionOption {
            id: option_id,
            option_type,
            strike_price,
            expiration,
            emission_period_start,
            emission_period_end,
            underlying_amount,
            premium,
            collateral_amount,
            writer: writer.clone(),
            buyer: None,
            status: OptionStatus::Open,
            created_at: current_time,
        };

        // Store option
        env.storage().persistent().set(&DataKey::Option(option_id), &option);

        // Add to user's options
        Self::add_user_option(&env, &writer, option_id);

        // Emit event
        env.events().publish(
            (symbol_short!("write"), writer.clone()),
            (option_id, strike_price, expiration, underlying_amount),
        );

        log!(&env, "Option {} written by {:?}", option_id, writer);
        
        Ok(option_id)
    }

    /// Buy an option from the market
    pub fn buy_option(env: Env, buyer: Address, option_id: u64) -> Result<(), Error> {
        buyer.require_auth();

        // Get option
        let mut option: EmissionOption = env.storage().persistent()
            .get(&DataKey::Option(option_id))
            .ok_or(Error::OptionNotFound)?;

        // Validate option state
        if option.buyer.is_some() {
            return Err(Error::OptionAlreadyPurchased);
        }
        
        let current_time = env.ledger().timestamp();
        if option.expiration <= current_time {
            return Err(Error::OptionExpired);
        }

        // Transfer premium from buyer to writer
        let settlement_token: Address = env.storage().instance()
            .get(&DataKey::SettlementToken)
            .ok_or(Error::NotInitialized)?;
        
        // Calculate protocol fee
        let protocol_fee: u32 = env.storage().instance()
            .get(&DataKey::ProtocolFee)
            .unwrap_or(30); // Default 0.3%
        
        let fee_amount = (option.premium * protocol_fee as i128) / 10000;
        let writer_amount = option.premium - fee_amount;

        let token_client = TokenClient::new(&env, &settlement_token);
        
        // Pay writer
        token_client.transfer(&buyer, &option.writer, &writer_amount);
        
        // Pay protocol fee to treasury
        if fee_amount > 0 {
            let treasury: Address = env.storage().instance()
                .get(&DataKey::TreasuryAddress)
                .ok_or(Error::NotInitialized)?;
            token_client.transfer(&buyer, &treasury, &fee_amount);
        }

        // Update option
        option.buyer = Some(buyer.clone());
        option.status = OptionStatus::Active;
        env.storage().persistent().set(&DataKey::Option(option_id), &option);

        // Add to buyer's options
        Self::add_user_option(&env, &buyer, option_id);

        // Emit event
        env.events().publish(
            (symbol_short!("buy"), buyer.clone()),
            (option_id, option.premium),
        );

        log!(&env, "Option {} bought by {:?}", option_id, buyer);
        
        Ok(())
    }

    /// Exercise an option (only by buyer, before expiration)
    pub fn exercise_option(env: Env, caller: Address, option_id: u64) -> Result<(), Error> {
        caller.require_auth();

        let mut option: EmissionOption = env.storage().persistent()
            .get(&DataKey::Option(option_id))
            .ok_or(Error::OptionNotFound)?;

        // Validate caller is buyer
        let buyer = option.buyer.as_ref().ok_or(Error::CannotExercise)?;
        if *buyer != caller {
            return Err(Error::Unauthorized);
        }

        // Check not already exercised/settled
        if option.status != OptionStatus::Active {
            return Err(Error::CannotExercise);
        }

        let current_time = env.ledger().timestamp();
        if option.expiration < current_time {
            return Err(Error::OptionExpired);
        }

        let settlement_token: Address = env.storage().instance()
            .get(&DataKey::SettlementToken)
            .ok_or(Error::NotInitialized)?;
        let collateral_token: Address = env.storage().instance()
            .get(&DataKey::CollateralToken)
            .ok_or(Error::NotInitialized)?;

        let settlement_client = TokenClient::new(&env, &settlement_token);
        let collateral_client = TokenClient::new(&env, &collateral_token);

        match option.option_type {
            OptionType::Call => {
                // Buyer pays strike price, receives underlying/emissions
                let strike_total = option.strike_price * option.underlying_amount / 10_000_000; // Adjust for decimals
                settlement_client.transfer(&caller, &option.writer, &strike_total);
                collateral_client.transfer(&env.current_contract_address(), &caller, &option.collateral_amount);
            }
            OptionType::Put => {
                // Buyer delivers underlying, receives strike price
                collateral_client.transfer(&caller, &option.writer, &option.underlying_amount);
                settlement_client.transfer(&env.current_contract_address(), &caller, &(option.strike_price * option.underlying_amount / 10_000_000));
            }
        }

        // Update option status
        option.status = OptionStatus::Exercised;
        env.storage().persistent().set(&DataKey::Option(option_id), &option);

        // Update total collateral
        let total_collateral: i128 = env.storage().instance()
            .get(&DataKey::TotalCollateral)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalCollateral, &(total_collateral - option.collateral_amount));

        // Emit event
        env.events().publish(
            (symbol_short!("exercise"), caller.clone()),
            (option_id, option.option_type.clone()),
        );

        log!(&env, "Option {} exercised", option_id);

        Ok(())
    }

    /// Settle an expired option
    pub fn settle_option(env: Env, caller: Address, option_id: u64) -> Result<(), Error> {
        let mut option: EmissionOption = env.storage().persistent()
            .get(&DataKey::Option(option_id))
            .ok_or(Error::OptionNotFound)?;

        // Check option has expired
        let current_time = env.ledger().timestamp();
        if option.expiration > current_time {
            return Err(Error::OptionNotExpired);
        }

        // Check not already settled
        if option.status == OptionStatus::Settled || option.status == OptionStatus::Exercised {
            return Err(Error::AlreadySettled);
        }

        // Return collateral to writer
        let collateral_token: Address = env.storage().instance()
            .get(&DataKey::CollateralToken)
            .ok_or(Error::NotInitialized)?;
        
        let token_client = TokenClient::new(&env, &collateral_token);
        token_client.transfer(&env.current_contract_address(), &option.writer, &option.collateral_amount);

        // Update option status
        option.status = OptionStatus::Expired;
        env.storage().persistent().set(&DataKey::Option(option_id), &option);

        // Update total collateral
        let total_collateral: i128 = env.storage().instance()
            .get(&DataKey::TotalCollateral)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalCollateral, &(total_collateral - option.collateral_amount));

        // Emit event
        env.events().publish(
            (symbol_short!("settle"), caller),
            (option_id, Symbol::new(&env, "expired")),
        );

        log!(&env, "Option {} settled as expired", option_id);

        Ok(())
    }

    /// Get option details
    pub fn get_option(env: Env, option_id: u64) -> Result<EmissionOption, Error> {
        env.storage().persistent()
            .get(&DataKey::Option(option_id))
            .ok_or(Error::OptionNotFound)
    }

    /// Get all options for a user
    pub fn get_user_options(env: Env, user: Address) -> Vec<u64> {
        env.storage().persistent()
            .get(&DataKey::UserOptions(user))
            .unwrap_or(Vec::new(&env))
    }

    /// Get total number of options created
    pub fn get_option_count(env: Env) -> u64 {
        env.storage().instance()
            .get(&DataKey::OptionCounter)
            .unwrap_or(0)
    }

    /// Get total collateral locked
    pub fn get_total_collateral(env: Env) -> i128 {
        env.storage().instance()
            .get(&DataKey::TotalCollateral)
            .unwrap_or(0)
    }

    /// Get all open options (available for purchase)
    pub fn get_open_options(env: Env) -> Vec<EmissionOption> {
        let option_count: u64 = env.storage().instance()
            .get(&DataKey::OptionCounter)
            .unwrap_or(0);
        
        let mut open_options = Vec::new(&env);
        let current_time = env.ledger().timestamp();

        for id in 0..option_count {
            if let Some(option) = env.storage().persistent().get::<_, EmissionOption>(&DataKey::Option(id)) {
                if option.status == OptionStatus::Open && option.expiration > current_time {
                    open_options.push_back(option);
                }
            }
        }

        open_options
    }

    // === Admin Functions ===

    /// Update protocol fee (admin only)
    pub fn set_protocol_fee(env: Env, admin: Address, new_fee: u32) -> Result<(), Error> {
        admin.require_auth();
        
        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        
        if admin != stored_admin {
            return Err(Error::Unauthorized);
        }

        env.storage().instance().set(&DataKey::ProtocolFee, &new_fee);
        Ok(())
    }

    /// Update treasury address (admin only)
    pub fn set_treasury(env: Env, admin: Address, new_treasury: Address) -> Result<(), Error> {
        admin.require_auth();
        
        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        
        if admin != stored_admin {
            return Err(Error::Unauthorized);
        }

        env.storage().instance().set(&DataKey::TreasuryAddress, &new_treasury);
        Ok(())
    }

    // === Helper Functions ===

    fn add_user_option(env: &Env, user: &Address, option_id: u64) {
        let mut user_options: Vec<u64> = env.storage().persistent()
            .get(&DataKey::UserOptions(user.clone()))
            .unwrap_or(Vec::new(env));
        
        user_options.push_back(option_id);
        env.storage().persistent().set(&DataKey::UserOptions(user.clone()), &user_options);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    fn setup_test<'a>() -> (Env, EmissionOptionContractClient<'a>, Address, Address, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register_contract(None, EmissionOptionContract);
        let client = EmissionOptionContractClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        let collateral_token = Address::generate(&env);
        let settlement_token = Address::generate(&env);
        let emission_token = Address::generate(&env);
        let treasury = Address::generate(&env);

        client.initialize(
            &admin,
            &collateral_token,
            &settlement_token,
            &emission_token,
            &30u32,
            &treasury,
        );

        (env, client, admin, collateral_token, settlement_token, treasury)
    }

    #[test]
    fn test_initialize() {
        let (env, client, _, _, _, _) = setup_test();
        assert_eq!(client.get_option_count(), 0);
        assert_eq!(client.get_total_collateral(), 0);
    }

    #[test]
    fn test_get_open_options_empty() {
        let (env, client, _, _, _, _) = setup_test();
        let open_options = client.get_open_options();
        assert_eq!(open_options.len(), 0);
    }
}
