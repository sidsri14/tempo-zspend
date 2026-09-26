# Z-Spend on Arc — `AgentBudget`

On-chain spend-limit enforcement for an AI agent treasury, deployed on **Arc**
(Circle's L1, chain **5042**, native **USDC gas**).

This is the Z-Spend enforcement story, portable to EVM:

```
off-chain policy gate  →  on-chain budget  →  USDC moves only while budget remains
(src/policy.ts,          (this contract)       even a compromised agent key
 fail-closed verdicts)                         cannot exceed its limit
```

Entry target: **Arc Microgrants (Circle)** on DoraHacks — 20 × 500 USDC,
closes **2026-10-14 23:59 ET**, rolling review, decisions by Oct 21.

## Requirements (from the program)
- live deployment on **Arc mainnet** with an openable link
- public repo ✓ (`sidsri14/tempo-zspend`)
- short description of what it does + what it uses Arc for
- public builder profile (GitHub `sidsri14`)
- **not eligible**: testnet-only builds, decks, mockups

## Network
| | mainnet | testnet |
|---|---|---|
| chain id | 5042 (`0x13b2`) | 5042002 |
| RPC | `https://rpc.mainnet.arc.io` | `https://rpc.testnet.arc.io` |
| gas token | USDC (≈0.01/tx) | USDC (faucet) |
| native USDC | `0x3600000000000000000000000000000000000000` | — |

Verified live Sep 24 2026: `eth_chainId` → `0x13b2`, `symbol()` → `USDC`, `decimals()` → `6`.

## Commands
```bash
npm install
npm run compile     # solc 0.8.37, optimizer 200 → artifacts/*.json
npm test            # 7 tests on a real local EVM (@ethereumjs/vm)
```

Deploy (needs USDC for gas):
```bash
node -e "console.log('0x'+require('crypto').randomBytes(32).toString('hex'))"   # throwaway key
PRIVATE_KEY=0x... node deploy.mjs
```

## Contract
`contracts/AgentBudget.sol` — owner authorizes an agent with a per-window USDC
limit; the agent calls `spend(to, amount)`; the contract reverts
(`ExceedsRemaining`) when the window budget is exhausted. Views:
`budgetOf`, `remaining`, `usdcBalance`. Events: `AgentAuthorized`,
`AgentLimitUpdated`, `AgentRevoked`, `Spend`.

Tests cover: deploy+fund · in-budget spend moves funds and shrinks `remaining` ·
over-budget reverts with correct args (no partial fill) · unauthorised caller
reverts `AgentInactive` · revoke then spend reverts · non-owner `authorize`
reverts `NotOwner` · window rollover resets allowance.