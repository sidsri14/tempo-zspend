// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract CeloAgentBudget {
    address public immutable owner;
    IERC20 public immutable paymentToken;
    uint256 public immutable window;

    struct Budget {
        uint256 limit;
        uint256 windowStart;
        uint256 spent;
        bool active;
    }

    mapping(address => Budget) public budgets;

    event AgentAuthorized(address indexed agent, uint256 limit, uint256 windowStart);
    event AgentRevoked(address indexed agent, uint256 spentInWindow);
    event AgentLimitUpdated(address indexed agent, uint256 oldLimit, uint256 newLimit);
    event ServicePaid(
        address indexed agent,
        address indexed serviceProvider,
        uint256 amount,
        string serviceId,
        bytes32 requestId,
        uint256 remaining
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

    constructor(address paymentTokenAddress, uint256 windowSeconds) {
        if (paymentTokenAddress == address(0)) revert ZeroAddress();
        if (windowSeconds == 0) revert ZeroLimit();
        owner = msg.sender;
        paymentToken = IERC20(paymentTokenAddress);
        window = windowSeconds;
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
        Budget storage b = budgets[agent];
        b.active = false;
        emit AgentRevoked(agent, b.spent);
    }

    function updateLimit(address agent, uint256 newLimit) external onlyOwner {
        if (newLimit == 0) revert ZeroLimit();
        Budget storage b = budgets[agent];
        if (!b.active) revert AgentInactive(agent);

        uint256 oldLimit = b.limit;
        b.limit = newLimit;
        emit AgentLimitUpdated(agent, oldLimit, newLimit);
    }

    function payService(
        address serviceProvider,
        uint256 amount,
        string calldata serviceId,
        bytes32 requestId
    ) external returns (bool) {
        if (serviceProvider == address(0)) revert ZeroAddress();
        Budget storage b = budgets[msg.sender];
        if (!b.active) revert AgentInactive(msg.sender);

        if (block.timestamp >= b.windowStart + window) {
            b.windowStart = block.timestamp;
            b.spent = 0;
        }

        uint256 remaining = b.limit > b.spent ? b.limit - b.spent : 0;
        if (amount > remaining) {
            revert ExceedsRemaining(amount, remaining);
        }

        b.spent += amount;

        bool success = paymentToken.transfer(serviceProvider, amount);
        if (!success) revert TransferFailed();

        emit ServicePaid(
            msg.sender,
            serviceProvider,
            amount,
            serviceId,
            requestId,
            b.limit - b.spent
        );

        return true;
    }

    function getRemainingBudget(address agent) external view returns (uint256 remaining, uint256 windowExpiresAt) {
        Budget storage b = budgets[agent];
        if (!b.active) return (0, 0);

        if (block.timestamp >= b.windowStart + window) {
            return (b.limit, block.timestamp + window);
        }

        remaining = b.limit > b.spent ? b.limit - b.spent : 0;
        windowExpiresAt = b.windowStart + window;
    }
}
