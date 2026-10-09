# Z-Spend on Arc - `AgentBudget`

On-chain spend-limit enforcement for an AI agent treasury, deployed on **Arc**
(Circle's L1, chain **5042**, native **USDC gas**).

This is the Z-Spend enforcement story, portable to EVM:

```
off-chain policy gate  ->  on-chain budget  ->  USDC moves only while budget remains
(src/policy.ts,          (this contract)       even a compromised agent key
 fail-closed verdicts)                         cannot exceed its limit
```

Entry target: **Arc Microgrants (Circle)** on DoraHacks - 20 x 500 USDC,
closes **2026-10-14 23:59 ET**, rolling review, decisions by Oct 21.

## Requirements (from the program)
- live deployment on **Arc mainnet** with an openable link
- public repo (`sidsri14/tempo-zspend`)
- short description of what it does + what it uses Arc for
- public builder profile (GitHub `sidsri14`)
- **not eligible**: testnet-only builds, decks, mockups

## Network
| | mainnet | testnet |
|---|---|---|
| chain id | 5042 (`0x13b2`) | 5042002 |
| RPC | `https://rpc.mainnet.arc.io` | `https://rpc.testnet.arc.io` |
| gas token | native USDC, 18-decimal interface | native USDC, 18-decimal interface (faucet) |
| optional ERC-20 interface | `0x3600000000000000000000000000000000000000`, 6 decimals | same address, 6 decimals |

Arc exposes one underlying USDC balance through two interfaces: native gas values
use 18 decimals, while the optional ERC-20 interface uses 6. `AgentBudget` calls
the ERC-20 interface, so its balances, limits, and transfer amounts use 6 decimals.
Deployment gas estimates and wallet native balances use 18 decimals. Do not mix
raw values between these interfaces.

## Commands
```bash
npm install
npm run compile     # solc 0.8.37, optimizer 200 -> artifacts/*.json
npm test            # 9 tests on a real local EVM (@ethereumjs/vm)
```

Deploy (needs USDC for gas):
```bash
node -e "console.log('0x'+require('crypto').randomBytes(32).toString('hex'))"   # throwaway key
PRIVATE_KEY=0x... node deploy.mjs  # read-only readiness check; does not deploy
CONFIRM_ARC_MAINNET_DEPLOY=YES PRIVATE_KEY=0x... node deploy.mjs
```

## Contract
`contracts/AgentBudget.sol` - owner authorizes an agent with a per-window USDC
limit; the agent calls `spend(to, amount)`; the contract reverts
(`ExceedsRemaining`) when the window budget is exhausted. Views:
`budgetOf`, `remaining`, `usdcBalance`. Events: `AgentAuthorized`,
`AgentLimitUpdated`, `AgentRevoked`, `Spend`.

Tests cover deployment and treasury funding; 6-decimal USDC accounting; in-budget
transfers; fail-closed over-budget reverts; unauthorized callers; revocation;
owner-only authorization; rejecting a live-window limit below already-spent USDC;
rejecting zero-value spends; and window rollover.

Verified on 2026-10-09: 9/9 tests pass, syntax checks pass for the deployment and
authorization scripts, `npm audit --omit=dev --audit-level=high` reports zero
vulnerabilities, and the optimized contract is 2,390 bytes at runtime.
