// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title AgentBudget — on-chain spend-limit enforcement for an AI agent treasury.
/// @notice Z-Spend port to Arc (chain 5042, native USDC gas).
///
/// The Z-Spend story, on EVM:
///   off-chain policy gate (src/policy.ts, fail-closed verdicts)
///   + on-chain budget (this contract: the agent physically cannot exceed its limit)
///
/// Even if the agent key is compromised, the contract only moves USDC while the
/// agent's remaining budget for the current window is >= the requested amount.
contract AgentBudget {
    address public immutable owner;
    IERC20 public immutable usdc;
    /// @notice Budget window length in seconds (1 days in production deployments).
    uint256 public immutable window;

    struct Budget {
        uint256 limit;        // per-window limit in USDC base units (6 decimals)
        uint256 windowStart;  // epoch secs of current window
        uint256 spent;        // spent in current window
        bool active;
    }

    mapping(address => Budget) internal budgets;

    event AgentAuthorized(address indexed agent, uint256 limitUnits, uint256 windowStart);
    event AgentRevoked(address indexed agent, uint256 spent);
    event AgentLimitUpdated(address indexed agent, uint256 oldLimit, uint256 newLimit);
    event Spend(
        address indexed agent,
        address indexed to,
        uint256 amount,
        uint256 windowStart,
        uint256 windowSpent,
        uint256 windowLimit
    );

    error NotOwner();
    error AgentInactive(address agent);
    error ExceedsRemaining(uint256 requested, uint256 remaining);
    error TransferFailed();
    error ZeroLimit();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address usdcAddress, uint256 windowSeconds) {
        if (usdcAddress == address(0)) revert ZeroAddress();
        if (windowSeconds == 0) revert ZeroLimit();
        owner = msg.sender;
        usdc = IERC20(usdcAddress);
        window = windowSeconds;
    }

    /// @notice Authorize (or re-authorize) an agent with a fresh per-window budget.
    function authorize(address agent, uint256 limitUnits) external onlyOwner {
        if (agent == address(0)) revert ZeroAddress();
        if (limitUnits == 0) revert ZeroLimit();
        Budget storage b = budgets[agent];
        emit AgentLimitUpdated(agent, b.limit, limitUnits);
        b.limit = limitUnits;
        b.active = true;
        if (b.windowStart == 0 || block.timestamp >= b.windowStart + window) {
            b.windowStart = block.timestamp;
            b.spent = 0;
        }
        emit AgentAuthorized(agent, limitUnits, b.windowStart);
    }

    /// @notice Revoke an agent. Already-windowed spend is kept for audit.
    function revoke(address agent) external onlyOwner {
        Budget storage b = budgets[agent];
        b.active = false;
        emit AgentRevoked(agent, b.spent);
    }

    /// @notice Agent moves USDC to `to`, subject to the on-chain budget.
    /// @dev Fail-closed: inactive agents and over-budget sends revert (no partial fills).
    function spend(address to, uint256 amount) external returns (bool) {
        Budget storage b = budgets[msg.sender];
        if (!b.active) revert AgentInactive(msg.sender);
        if (to == address(0)) revert ZeroAddress();

        if (block.timestamp >= b.windowStart + window) {
            b.windowStart = block.timestamp;
            b.spent = 0;
        }

        uint256 left = b.limit - b.spent;
        if (amount > left) revert ExceedsRemaining(amount, left);

        b.spent += amount;
        if (!usdc.transfer(to, amount)) revert TransferFailed();

        emit Spend(msg.sender, to, amount, b.windowStart, b.spent, b.limit);
        return true;
    }

    // ---- views (dashboard / policy oracle) ----

    function budgetOf(address agent)
        external
        view
        returns (uint256 limit, uint256 windowStart, uint256 spent, bool active)
    {
        Budget storage b = budgets[agent];
        uint256 ws = b.windowStart;
        uint256 sp = b.spent;
        if (ws != 0 && block.timestamp >= ws + window) {
            ws = block.timestamp;
            sp = 0;
        }
        return (b.limit, ws, sp, b.active);
    }

    /// @notice USDC the agent may still spend in the current window.
    function remaining(address agent) public view returns (uint256) {
        Budget storage b = budgets[agent];
        if (!b.active) return 0;
        if (b.windowStart != 0 && block.timestamp >= b.windowStart + window) return b.limit;
        return b.limit - b.spent;
    }

    function usdcBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}