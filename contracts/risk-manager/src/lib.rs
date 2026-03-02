#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    symbol_short, Address, Env, Vec, log,
};

/// Risk levels
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RiskLevel {
    Normal,
    Elevated,
    High,
    Critical,
}

/// Circuit breaker status
#[contracttype]
#[derive(Clone, Debug)]
pub struct CircuitBreaker {
    pub is_active: bool,
    pub triggered_at: u64,
    pub reason: soroban_sdk::String,
    pub triggered_by: Address,
    pub auto_resume_at: Option<u64>,
}

/// Risk parameters
#[contracttype]
#[derive(Clone, Debug)]
pub struct RiskParams {
    pub max_volatility: u32,
    pub min_collateral_ratio: u32,
    pub max_position_size: i128,
    pub max_daily_volume: i128,
    pub liquidation_threshold: u32,
    pub pause_threshold_pct: u32,
}

/// Insurance fund status
#[contracttype]
#[derive(Clone, Debug)]
pub struct InsuranceFund {
    pub balance: i128,
    pub min_balance: i128,
    pub last_used: u64,
    pub total_payouts: i128,
}

/// Storage keys
#[contracttype]
pub enum DataKey {
    Admin,
    Guardians,
    RiskParams,
    CircuitBreaker,
    InsuranceFund,
    RiskLevel,
    DailyVolume(u64),
    VolatilityHistory,
    LastUpdate,
}

/// Contract errors
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    TradingPaused = 4,
    VolatilityTooHigh = 5,
    PositionTooLarge = 6,
    DailyLimitExceeded = 7,
    InsufficientInsurance = 8,
    AlreadyGuardian = 9,
    NotGuardian = 10,
}

#[contract]
pub struct RiskManagerContract;

#[contractimpl]
impl RiskManagerContract {
    /// Initialize risk manager
    pub fn initialize(
        env: Env,
        admin: Address,
        risk_params: RiskParams,
        insurance_min_balance: i128,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::RiskParams, &risk_params);
        env.storage().instance().set(&DataKey::RiskLevel, &RiskLevel::Normal);
        env.storage().instance().set(&DataKey::Guardians, &Vec::<Address>::new(&env));

        let insurance = InsuranceFund {
            balance: 0,
            min_balance: insurance_min_balance,
            last_used: 0,
            total_payouts: 0,
        };
        env.storage().instance().set(&DataKey::InsuranceFund, &insurance);

        let cb = CircuitBreaker {
            is_active: false,
            triggered_at: 0,
            reason: soroban_sdk::String::from_str(&env, ""),
            triggered_by: admin.clone(),
            auto_resume_at: None,
        };
        env.storage().instance().set(&DataKey::CircuitBreaker, &cb);

        Ok(())
    }

    /// Check if trading is allowed
    pub fn check_trading_allowed(env: Env) -> Result<bool, Error> {
        let cb: CircuitBreaker = env.storage().instance()
            .get(&DataKey::CircuitBreaker)
            .ok_or(Error::NotInitialized)?;

        if cb.is_active {
            if let Some(resume_at) = cb.auto_resume_at {
                if env.ledger().timestamp() >= resume_at {
                    return Ok(true);
                }
            }
            return Err(Error::TradingPaused);
        }
        Ok(true)
    }

    /// Validate a trade against risk parameters
    pub fn validate_trade(
        env: Env,
        position_size: i128,
        current_volatility: u32,
    ) -> Result<bool, Error> {
        Self::check_trading_allowed(env.clone())?;

        let params: RiskParams = env.storage().instance()
            .get(&DataKey::RiskParams)
            .ok_or(Error::NotInitialized)?;

        if current_volatility > params.max_volatility {
            return Err(Error::VolatilityTooHigh);
        }

        if position_size > params.max_position_size {
            return Err(Error::PositionTooLarge);
        }

        let today = env.ledger().timestamp() / 86400;
        let daily_vol: i128 = env.storage().persistent()
            .get(&DataKey::DailyVolume(today))
            .unwrap_or(0);

        if daily_vol + position_size > params.max_daily_volume {
            return Err(Error::DailyLimitExceeded);
        }

        Ok(true)
    }

    /// Record trade volume
    pub fn record_volume(env: Env, volume: i128) -> Result<(), Error> {
        let today = env.ledger().timestamp() / 86400;
        let current: i128 = env.storage().persistent()
            .get(&DataKey::DailyVolume(today))
            .unwrap_or(0);
        env.storage().persistent().set(&DataKey::DailyVolume(today), &(current + volume));
        Ok(())
    }

    /// Trigger circuit breaker (admin/guardian only)
    pub fn pause_trading(
        env: Env,
        caller: Address,
        reason: soroban_sdk::String,
        auto_resume_seconds: Option<u64>,
    ) -> Result<(), Error> {
        caller.require_auth();
        Self::require_guardian_or_admin(&env, &caller)?;

        let current_time = env.ledger().timestamp();
        let auto_resume = auto_resume_seconds.map(|s| current_time + s);

        let cb = CircuitBreaker {
            is_active: true,
            triggered_at: current_time,
            reason,
            triggered_by: caller.clone(),
            auto_resume_at: auto_resume,
        };
        env.storage().instance().set(&DataKey::CircuitBreaker, &cb);
        env.storage().instance().set(&DataKey::RiskLevel, &RiskLevel::Critical);

        env.events().publish((symbol_short!("pause"), caller), current_time);
        log!(&env, "Trading paused");

        Ok(())
    }

    /// Resume trading (admin only)
    pub fn resume_trading(env: Env, admin: Address) -> Result<(), Error> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;

        let mut cb: CircuitBreaker = env.storage().instance()
            .get(&DataKey::CircuitBreaker)
            .ok_or(Error::NotInitialized)?;

        cb.is_active = false;
        cb.auto_resume_at = None;
        env.storage().instance().set(&DataKey::CircuitBreaker, &cb);
        env.storage().instance().set(&DataKey::RiskLevel, &RiskLevel::Normal);

        env.events().publish((symbol_short!("resume"), admin), env.ledger().timestamp());

        Ok(())
    }

    /// Update risk parameters (admin only)
    pub fn update_risk_params(env: Env, admin: Address, params: RiskParams) -> Result<(), Error> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;
        env.storage().instance().set(&DataKey::RiskParams, &params);
        Ok(())
    }

    /// Add guardian (admin only)
    pub fn add_guardian(env: Env, admin: Address, guardian: Address) -> Result<(), Error> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;

        let mut guardians: Vec<Address> = env.storage().instance()
            .get(&DataKey::Guardians)
            .unwrap_or(Vec::new(&env));

        for g in guardians.iter() {
            if g == guardian {
                return Err(Error::AlreadyGuardian);
            }
        }

        guardians.push_back(guardian);
        env.storage().instance().set(&DataKey::Guardians, &guardians);
        Ok(())
    }

    /// Deposit to insurance fund
    pub fn deposit_insurance(env: Env, _depositor: Address, amount: i128) -> Result<(), Error> {
        let mut fund: InsuranceFund = env.storage().instance()
            .get(&DataKey::InsuranceFund)
            .ok_or(Error::NotInitialized)?;

        fund.balance += amount;
        env.storage().instance().set(&DataKey::InsuranceFund, &fund);
        Ok(())
    }

    /// Use insurance fund for payout (admin only)
    pub fn use_insurance(env: Env, admin: Address, amount: i128) -> Result<(), Error> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;

        let mut fund: InsuranceFund = env.storage().instance()
            .get(&DataKey::InsuranceFund)
            .ok_or(Error::NotInitialized)?;

        if fund.balance < amount {
            return Err(Error::InsufficientInsurance);
        }

        fund.balance -= amount;
        fund.total_payouts += amount;
        fund.last_used = env.ledger().timestamp();
        env.storage().instance().set(&DataKey::InsuranceFund, &fund);
        Ok(())
    }

    // === View Functions ===

    pub fn get_risk_params(env: Env) -> Result<RiskParams, Error> {
        env.storage().instance().get(&DataKey::RiskParams).ok_or(Error::NotInitialized)
    }

    pub fn get_circuit_breaker(env: Env) -> Result<CircuitBreaker, Error> {
        env.storage().instance().get(&DataKey::CircuitBreaker).ok_or(Error::NotInitialized)
    }

    pub fn get_insurance_fund(env: Env) -> Result<InsuranceFund, Error> {
        env.storage().instance().get(&DataKey::InsuranceFund).ok_or(Error::NotInitialized)
    }

    pub fn get_risk_level(env: Env) -> RiskLevel {
        env.storage().instance().get(&DataKey::RiskLevel).unwrap_or(RiskLevel::Normal)
    }

    pub fn get_daily_volume(env: Env, day: u64) -> i128 {
        env.storage().persistent().get(&DataKey::DailyVolume(day)).unwrap_or(0)
    }

    pub fn is_trading_paused(env: Env) -> bool {
        if let Some(cb) = env.storage().instance().get::<_, CircuitBreaker>(&DataKey::CircuitBreaker) {
            cb.is_active
        } else {
            false
        }
    }

    // === Helper Functions ===

    fn require_admin(env: &Env, caller: &Address) -> Result<(), Error> {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        if *caller != admin {
            return Err(Error::Unauthorized);
        }
        Ok(())
    }

    fn require_guardian_or_admin(env: &Env, caller: &Address) -> Result<(), Error> {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        
        if *caller == admin {
            return Ok(());
        }

        let guardians: Vec<Address> = env.storage().instance()
            .get(&DataKey::Guardians)
            .unwrap_or(Vec::new(env));

        for g in guardians.iter() {
            if g == *caller {
                return Ok(());
            }
        }

        Err(Error::Unauthorized)
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
        
        let contract_id = env.register_contract(None, RiskManagerContract);
        let client = RiskManagerContractClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        let params = RiskParams {
            max_volatility: 10000,
            min_collateral_ratio: 150,
            max_position_size: 1_000_000_000,
            max_daily_volume: 10_000_000_000,
            liquidation_threshold: 110,
            pause_threshold_pct: 20,
        };

        client.initialize(&admin, &params, &100_000_000);
        
        assert!(!client.is_trading_paused());
    }
}
