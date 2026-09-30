//! 🛡️ Soroban SpendGuard: Native Rust Risk Control & Spend Firewall for Stellar Soroban
//! Enforces rolling budget windows, per-operator drawdown caps, and fail-closed treasury protection.

pub struct AgentAllowance {
    pub daily_limit: u128,
    pub spent_in_window: u128,
    pub window_start_timestamp: u64,
    pub window_duration_seconds: u64,
    pub is_active: bool,
}

pub struct SpendGuard {
    pub owner: [u8; 32],
    pub treasury_balance: u128,
    pub allowances: std::collections::HashMap<[u8; 32], AgentAllowance>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum GuardError {
    Unauthorized,
    AgentInactive,
    ExceedsRemainingBudget,
    InsufficientTreasuryBalance,
    InvalidParameters,
}

impl SpendGuard {
    pub fn new(owner: [u8; 32]) -> Self {
        Self {
            owner,
            treasury_balance: 0,
            allowances: std::collections::HashMap::new(),
        }
    }

    pub fn deposit(&mut self, amount: u128) {
        self.treasury_balance += amount;
    }

    pub fn authorize_agent(
        &mut self,
        caller: [u8; 32],
        agent: [u8; 32],
        daily_limit: u128,
        window_duration: u64,
        current_time: u64,
    ) -> Result<(), GuardError> {
        if caller != self.owner {
            return Err(GuardError::Unauthorized);
        }
        if daily_limit == 0 || window_duration == 0 {
            return Err(GuardError::InvalidParameters);
        }

        self.allowances.insert(
            agent,
            AgentAllowance {
                daily_limit,
                spent_in_window: 0,
                window_start_timestamp: current_time,
                window_duration_seconds: window_duration,
                is_active: true,
            },
        );
        Ok(())
    }

    pub fn revoke_agent(&mut self, caller: [u8; 32], agent: [u8; 32]) -> Result<(), GuardError> {
        if caller != self.owner {
            return Err(GuardError::Unauthorized);
        }
        if let Some(allowance) = self.allowances.get_mut(&agent) {
            allowance.is_active = false;
        }
        Ok(())
    }

    pub fn get_remaining_budget(&self, agent: &[u8; 32], current_time: u64) -> u128 {
        match self.allowances.get(agent) {
            Some(allowance) if allowance.is_active => {
                if current_time >= allowance.window_start_timestamp + allowance.window_duration_seconds {
                    allowance.daily_limit
                } else {
                    allowance.daily_limit.saturating_sub(allowance.spent_in_window)
                }
            }
            _ => 0,
        }
    }

    pub fn execute_spend(
        &mut self,
        agent: [u8; 32],
        recipient: [u8; 32],
        amount: u128,
        current_time: u64,
    ) -> Result<u128, GuardError> {
        let _ = recipient;
        if amount == 0 {
            return Err(GuardError::InvalidParameters);
        }

        // 1. Check authorization first
        let allowance = self.allowances.get_mut(&agent).ok_or(GuardError::AgentInactive)?;
        if !allowance.is_active {
            return Err(GuardError::AgentInactive);
        }

        // 2. Check treasury balance
        if self.treasury_balance < amount {
            return Err(GuardError::InsufficientTreasuryBalance);
        }

        // 3. Automatic window rollover
        if current_time >= allowance.window_start_timestamp + allowance.window_duration_seconds {
            allowance.spent_in_window = 0;
            allowance.window_start_timestamp = current_time;
        }

        // 4. Budget check
        let remaining = allowance.daily_limit.saturating_sub(allowance.spent_in_window);
        if amount > remaining {
            return Err(GuardError::ExceedsRemainingBudget);
        }

        allowance.spent_in_window += amount;
        self.treasury_balance -= amount;

        Ok(self.treasury_balance)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const OWNER: [u8; 32] = [1u8; 32];
    const AGENT: [u8; 32] = [2u8; 32];
    const RECIPIENT: [u8; 32] = [3u8; 32];
    const ATTACKER: [u8; 32] = [9u8; 32];

    #[test]
    fn test_authorize_and_spend_within_budget() {
        let mut guard = SpendGuard::new(OWNER);
        guard.deposit(100_000);

        guard.authorize_agent(OWNER, AGENT, 5_000, 86400, 1000).unwrap();
        assert_eq!(guard.get_remaining_budget(&AGENT, 1000), 5_000);

        let rem_treasury = guard.execute_spend(AGENT, RECIPIENT, 2_000, 1050).unwrap();
        assert_eq!(rem_treasury, 98_000);
        assert_eq!(guard.get_remaining_budget(&AGENT, 1050), 3_000);
    }

    #[test]
    fn test_revert_exceeds_budget_fail_closed() {
        let mut guard = SpendGuard::new(OWNER);
        guard.deposit(100_000);

        guard.authorize_agent(OWNER, AGENT, 5_000, 86400, 1000).unwrap();
        let res = guard.execute_spend(AGENT, RECIPIENT, 6_000, 1050);
        assert_eq!(res, Err(GuardError::ExceedsRemainingBudget));
        assert_eq!(guard.treasury_balance, 100_000);
    }

    #[test]
    fn test_automatic_window_rollover() {
        let mut guard = SpendGuard::new(OWNER);
        guard.deposit(100_000);

        guard.authorize_agent(OWNER, AGENT, 5_000, 86400, 1000).unwrap();
        guard.execute_spend(AGENT, RECIPIENT, 4_000, 1050).unwrap();
        assert_eq!(guard.get_remaining_budget(&AGENT, 1050), 1_000);

        // Advance past 24 hours (86400s)
        let future_time = 1000 + 86401;
        assert_eq!(guard.get_remaining_budget(&AGENT, future_time), 5_000);

        guard.execute_spend(AGENT, RECIPIENT, 5_000, future_time).unwrap();
        assert_eq!(guard.get_remaining_budget(&AGENT, future_time), 0);
    }

    #[test]
    fn test_unauthorized_actions_fail() {
        let mut guard = SpendGuard::new(OWNER);
        guard.deposit(100_000);

        let res = guard.authorize_agent(ATTACKER, AGENT, 5_000, 86400, 1000);
        assert_eq!(res, Err(GuardError::Unauthorized));

        guard.authorize_agent(OWNER, AGENT, 5_000, 86400, 1000).unwrap();
        guard.revoke_agent(OWNER, AGENT).unwrap();

        let spend_res = guard.execute_spend(AGENT, RECIPIENT, 100, 1000);
        assert_eq!(spend_res, Err(GuardError::AgentInactive));
    }
}
