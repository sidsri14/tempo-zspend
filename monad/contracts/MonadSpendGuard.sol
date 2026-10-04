// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MonadSpendGuard
/// @notice Native-MON escrow with hard per-agent rolling spend limits.
/// @dev This contract is ordinary EVM bytecode and is intended for Monad testnet.
contract MonadSpendGuard {
    address public immutable owner;
    uint256 public immutable window;

    struct Budget {
        uint256 limit;
        uint256 windowStart;
        uint256 spent;
        bool active;
    }

    mapping(address => Budget) public budgets;

    event Deposited(address indexed from, uint256 amount, uint256 balance);
    event AgentAuthorized(address indexed agent, uint256 limit, uint256 windowStart);
    event AgentRevoked(address indexed agent, uint256 spentInWindow);
    event AgentLimitUpdated(address indexed agent, uint256 oldLimit, uint256 newLimit);
    event SpendExecuted(
        address indexed agent,
        address indexed recipient,
        uint256 amount,
        uint256 windowStart,
        uint256 windowSpent,
        uint256 remaining
    );
    event OwnerWithdrawal(address indexed recipient, uint256 amount);

    error NotOwner();
    error AgentInactive(address agent);
    error ExceedsRemaining(uint256 requested, uint256 remaining);
    error InsufficientEscrow(uint256 requested, uint256 available);
    error TransferFailed();
    error ZeroAddress();
    error ZeroLimit();
    error ZeroAmount();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(uint256 windowSeconds) {
        if (windowSeconds == 0) revert ZeroLimit();
        owner = msg.sender;
        window = windowSeconds;
    }

    receive() external payable {
        if (msg.value == 0) revert ZeroAmount();
        emit Deposited(msg.sender, msg.value, address(this).balance);
    }

    function authorizeAgent(address agent, uint256 limit) external onlyOwner {
        if (agent == address(0)) revert ZeroAddress();
        if (limit == 0) revert ZeroLimit();

        budgets[agent] = Budget({
            limit: limit,
            windowStart: block.timestamp,
            spent: 0,
            active: true
        });
        emit AgentAuthorized(agent, limit, block.timestamp);
    }

    function revokeAgent(address agent) external onlyOwner {
        Budget storage budget = budgets[agent];
        budget.active = false;
        emit AgentRevoked(agent, budget.spent);
    }

    function updateLimit(address agent, uint256 newLimit) external onlyOwner {
        if (newLimit == 0) revert ZeroLimit();
        Budget storage budget = budgets[agent];
        if (!budget.active) revert AgentInactive(agent);

        uint256 oldLimit = budget.limit;
        budget.limit = newLimit;
        emit AgentLimitUpdated(agent, oldLimit, newLimit);
    }

    function spend(address payable recipient, uint256 amount) external {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        Budget storage budget = budgets[msg.sender];
        if (!budget.active) revert AgentInactive(msg.sender);

        if (block.timestamp >= budget.windowStart + window) {
            budget.windowStart = block.timestamp;
            budget.spent = 0;
        }

        uint256 remaining = budget.limit > budget.spent ? budget.limit - budget.spent : 0;
        if (amount > remaining) revert ExceedsRemaining(amount, remaining);
        if (amount > address(this).balance) revert InsufficientEscrow(amount, address(this).balance);

        budget.spent += amount;
        (bool sent, ) = recipient.call{value: amount}("");
        if (!sent) revert TransferFailed();

        emit SpendExecuted(
            msg.sender,
            recipient,
            amount,
            budget.windowStart,
            budget.spent,
            budget.limit - budget.spent
        );
    }

    function withdraw(address payable recipient, uint256 amount) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > address(this).balance) revert InsufficientEscrow(amount, address(this).balance);

        (bool sent, ) = recipient.call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit OwnerWithdrawal(recipient, amount);
    }

    function getRemainingBudget(address agent) external view returns (uint256 remaining, uint256 windowExpiresAt) {
        Budget storage budget = budgets[agent];
        if (!budget.active) return (0, 0);
        if (block.timestamp >= budget.windowStart + window) return (budget.limit, block.timestamp + window);

        remaining = budget.limit > budget.spent ? budget.limit - budget.spent : 0;
        windowExpiresAt = budget.windowStart + window;
    }
}
