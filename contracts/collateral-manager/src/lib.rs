#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    symbol_short, Address, Env, Map, Vec, log,
    token::TokenClient,
};

/// User's collateral position
#[contracttype]
#[derive(Clone, Debug)]
pub struct CollateralPosition {
    pub user: Address,
    pub deposited_amount: i128,   // Total deposited
    pub locked_amount: i128,      // Amount locked in positions
    pub available_amount: i128,   // Available for withdrawal
    pub health_factor: u32,       // Health factor * 100 (e.g., 150 = 1.5)
    pub last_updated: u64,
}

/// Collateral configuration
#[contracttype]
#[derive(Clone, Debug)]
pub struct CollateralConfig {
    pub token: Address,
    pub price_feed: Address,           // Oracle address for price
    pub collateral_factor: u32,        // Factor * 100 (e.g., 80 = 80%)
    pub liquidation_threshold: u32,    // Threshold * 100 (e.g., 105 = 105%)
    pub liquidation_penalty: u32,      // Penalty * 100 (e.g., 10 = 10%)
    pub is_active: bool,
}

/// Storage keys
#[contracttype]
pub enum DataKey {
    Admin,
    Position(Address),
    CollateralConfig(Address), // Token address -> config
    SupportedTokens,
    TotalCollateral(Address),  // Token -> total
    MinHealthFactor,
    LiquidationBonus,
}

/// Contract errors
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    TokenNotSupported = 4,
    InsufficientCollateral = 5,
    InsufficientBalance = 6,
    PositionNotFound = 7,
    HealthFactorTooLow = 8,
    CannotLiquidate = 9,
    InvalidAmount = 10,
    TokenConfigExists = 11,
}

#[contract]
pub struct CollateralManagerContract;

#[contractimpl]
impl CollateralManagerContract {
    /// Initialize the collateral manager
    pub fn initialize(
        env: Env,
        admin: Address,
        min_health_factor: u32,    // Minimum health factor * 100
        liquidation_bonus: u32,    // Liquidator bonus * 100
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::MinHealthFactor, &min_health_factor);
        env.storage().instance().set(&DataKey::LiquidationBonus, &liquidation_bonus);
        env.storage().instance().set(&DataKey::SupportedTokens, &Vec::<Address>::new(&env));

        Ok(())
    }

    /// Add a supported collateral token (admin only)
    pub fn add_collateral_token(
        env: Env,
        admin: Address,
        token: Address,
        price_feed: Address,
        collateral_factor: u32,
        liquidation_threshold: u32,
        liquidation_penalty: u32,
    ) -> Result<(), Error> {
        admin.require_auth();

        let stored_admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        
        if admin != stored_admin {
            return Err(Error::Unauthorized);
        }

        // Check if token already configured
        if env.storage().persistent().has(&DataKey::CollateralConfig(token.clone())) {
            return Err(Error::TokenConfigExists);
        }

        let config = CollateralConfig {
            token: token.clone(),
            price_feed,
            collateral_factor,
            liquidation_threshold,
            liquidation_penalty,
            is_active: true,
        };

        env.storage().persistent().set(&DataKey::CollateralConfig(token.clone()), &config);

        // Add to supported tokens list
        let mut supported: Vec<Address> = env.storage().instance()
            .get(&DataKey::SupportedTokens)
            .unwrap_or(Vec::new(&env));
        supported.push_back(token.clone());
        env.storage().instance().set(&DataKey::SupportedTokens, &supported);

        // Initialize total collateral for this token
        env.storage().persistent().set(&DataKey::TotalCollateral(token.clone()), &0i128);

        log!(&env, "Collateral token {:?} added", token);

        Ok(())
    }

    /// Deposit collateral
    pub fn deposit(
        env: Env,
        user: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), Error> {
        user.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Check token is supported
        let config: CollateralConfig = env.storage().persistent()
            .get(&DataKey::CollateralConfig(token.clone()))
            .ok_or(Error::TokenNotSupported)?;
        
        if !config.is_active {
            return Err(Error::TokenNotSupported);
        }

        // Transfer tokens from user
        let token_client = TokenClient::new(&env, &token);
        token_client.transfer(&user, &env.current_contract_address(), &amount);

        // Update user position
        let mut position: CollateralPosition = env.storage().persistent()
            .get(&DataKey::Position(user.clone()))
            .unwrap_or(CollateralPosition {
                user: user.clone(),
                deposited_amount: 0,
                locked_amount: 0,
                available_amount: 0,
                health_factor: 10000, // Max health factor for no debt
                last_updated: env.ledger().timestamp(),
            });

        position.deposited_amount += amount;
        position.available_amount += amount;
        position.last_updated = env.ledger().timestamp();

        env.storage().persistent().set(&DataKey::Position(user.clone()), &position);

        // Update total collateral
        let total: i128 = env.storage().persistent()
            .get(&DataKey::TotalCollateral(token.clone()))
            .unwrap_or(0);
        env.storage().persistent().set(&DataKey::TotalCollateral(token.clone()), &(total + amount));

        // Emit event
        env.events().publish(
            (symbol_short!("deposit"), user),
            (token, amount),
        );

        Ok(())
    }

    /// Withdraw collateral
    pub fn withdraw(
        env: Env,
        user: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), Error> {
        user.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Get user position
        let mut position: CollateralPosition = env.storage().persistent()
            .get(&DataKey::Position(user.clone()))
            .ok_or(Error::PositionNotFound)?;

        // Check available balance
        if amount > position.available_amount {
            return Err(Error::InsufficientBalance);
        }

        // Check health factor after withdrawal
        let new_available = position.available_amount - amount;
        let new_deposited = position.deposited_amount - amount;
        
        // Calculate new health factor (simplified - in production would use oracle)
        if position.locked_amount > 0 {
            let min_hf: u32 = env.storage().instance()
                .get(&DataKey::MinHealthFactor)
                .unwrap_or(110);
            
            let new_hf = if new_deposited > 0 {
                ((new_deposited * 100) / position.locked_amount) as u32
            } else {
                0
            };
            
            if new_hf < min_hf {
                return Err(Error::HealthFactorTooLow);
            }
        }

        // Transfer tokens to user
        let token_client = TokenClient::new(&env, &token);
        token_client.transfer(&env.current_contract_address(), &user, &amount);

        // Update position
        position.deposited_amount = new_deposited;
        position.available_amount = new_available;
        position.last_updated = env.ledger().timestamp();
        Self::recalculate_health_factor(&env, &mut position);

        env.storage().persistent().set(&DataKey::Position(user.clone()), &position);

        // Update total collateral
        let total: i128 = env.storage().persistent()
            .get(&DataKey::TotalCollateral(token.clone()))
            .unwrap_or(0);
        env.storage().persistent().set(&DataKey::TotalCollateral(token.clone()), &(total - amount));

        // Emit event
        env.events().publish(
            (symbol_short!("withdraw"), user),
            (token, amount),
        );

        Ok(())
    }

    /// Lock collateral for a position (called by options contract)
    pub fn lock_collateral(
        env: Env,
        caller: Address,  // Should be options contract
        user: Address,
        amount: i128,
    ) -> Result<(), Error> {
        caller.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut position: CollateralPosition = env.storage().persistent()
            .get(&DataKey::Position(user.clone()))
            .ok_or(Error::PositionNotFound)?;

        if amount > position.available_amount {
            return Err(Error::InsufficientCollateral);
        }

        position.available_amount -= amount;
        position.locked_amount += amount;
        position.last_updated = env.ledger().timestamp();
        Self::recalculate_health_factor(&env, &mut position);

        env.storage().persistent().set(&DataKey::Position(user.clone()), &position);

        // Emit event
        env.events().publish(
            (symbol_short!("lock"), user),
            amount,
        );

        Ok(())
    }

    /// Unlock collateral (called by options contract on settlement)
    pub fn unlock_collateral(
        env: Env,
        caller: Address,  // Should be options contract
        user: Address,
        amount: i128,
    ) -> Result<(), Error> {
        caller.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut position: CollateralPosition = env.storage().persistent()
            .get(&DataKey::Position(user.clone()))
            .ok_or(Error::PositionNotFound)?;

        if amount > position.locked_amount {
            return Err(Error::InsufficientCollateral);
        }

        position.locked_amount -= amount;
        position.available_amount += amount;
        position.last_updated = env.ledger().timestamp();
        Self::recalculate_health_factor(&env, &mut position);

        env.storage().persistent().set(&DataKey::Position(user.clone()), &position);

        // Emit event
        env.events().publish(
            (symbol_short!("unlock"), user),
            amount,
        );

        Ok(())
    }

    /// Liquidate undercollateralized position
    pub fn liquidate(
        env: Env,
        liquidator: Address,
        user: Address,
        token: Address,
        debt_to_cover: i128,
    ) -> Result<i128, Error> {
        liquidator.require_auth();

        let mut position: CollateralPosition = env.storage().persistent()
            .get(&DataKey::Position(user.clone()))
            .ok_or(Error::PositionNotFound)?;

        // Check if position is liquidatable
        let min_hf: u32 = env.storage().instance()
            .get(&DataKey::MinHealthFactor)
            .unwrap_or(110);
        
        if position.health_factor >= min_hf {
            return Err(Error::CannotLiquidate);
        }

        let config: CollateralConfig = env.storage().persistent()
            .get(&DataKey::CollateralConfig(token.clone()))
            .ok_or(Error::TokenNotSupported)?;

        // Calculate collateral to seize (with bonus)
        let liquidation_bonus: u32 = env.storage().instance()
            .get(&DataKey::LiquidationBonus)
            .unwrap_or(5);
        
        let collateral_to_seize = debt_to_cover * (100 + liquidation_bonus as i128) / 100;

        if collateral_to_seize > position.deposited_amount {
            return Err(Error::InsufficientCollateral);
        }

        // Transfer debt from liquidator to contract (or burn/handle debt)
        let token_client = TokenClient::new(&env, &token);
        
        // Transfer collateral to liquidator
        token_client.transfer(&env.current_contract_address(), &liquidator, &collateral_to_seize);

        // Update position
        position.deposited_amount -= collateral_to_seize;
        position.available_amount = position.available_amount.saturating_sub(collateral_to_seize);
        position.locked_amount = position.locked_amount.saturating_sub(
            collateral_to_seize.saturating_sub(position.available_amount)
        );
        position.last_updated = env.ledger().timestamp();
        Self::recalculate_health_factor(&env, &mut position);

        env.storage().persistent().set(&DataKey::Position(user.clone()), &position);

        // Emit event
        env.events().publish(
            (symbol_short!("liq"), liquidator),
            (user, collateral_to_seize),
        );

        Ok(collateral_to_seize)
    }

    /// Get user's collateral position
    pub fn get_position(env: Env, user: Address) -> Result<CollateralPosition, Error> {
        env.storage().persistent()
            .get(&DataKey::Position(user))
            .ok_or(Error::PositionNotFound)
    }

    /// Get collateral configuration for a token
    pub fn get_collateral_config(env: Env, token: Address) -> Result<CollateralConfig, Error> {
        env.storage().persistent()
            .get(&DataKey::CollateralConfig(token))
            .ok_or(Error::TokenNotSupported)
    }

    /// Get all supported tokens
    pub fn get_supported_tokens(env: Env) -> Vec<Address> {
        env.storage().instance()
            .get(&DataKey::SupportedTokens)
            .unwrap_or(Vec::new(&env))
    }

    /// Get total collateral for a token
    pub fn get_total_collateral(env: Env, token: Address) -> i128 {
        env.storage().persistent()
            .get(&DataKey::TotalCollateral(token))
            .unwrap_or(0)
    }

    /// Check if a position is healthy
    pub fn is_healthy(env: Env, user: Address) -> bool {
        if let Some(position) = env.storage().persistent().get::<_, CollateralPosition>(&DataKey::Position(user)) {
            let min_hf: u32 = env.storage().instance()
                .get(&DataKey::MinHealthFactor)
                .unwrap_or(110);
            position.health_factor >= min_hf
        } else {
            true // No position = healthy
        }
    }

    // === Helper Functions ===

    fn recalculate_health_factor(env: &Env, position: &mut CollateralPosition) {
        if position.locked_amount == 0 {
            position.health_factor = 10000; // Max
        } else {
            position.health_factor = ((position.deposited_amount * 100) / position.locked_amount) as u32;
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
        
        let contract_id = env.register_contract(None, CollateralManagerContract);
        let client = CollateralManagerContractClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);

        client.initialize(&admin, &110, &5);
        
        assert_eq!(client.get_supported_tokens().len(), 0);
    }
}
