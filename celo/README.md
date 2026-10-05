# Z-Spend Celo — Agents on Open Rails Hackathon

Local prototype of an autonomous agent service payer and spend guard designed for Celo payment rails.

This package is not deployed to Celo and does not call a live x402 facilitator or third-party API. The included buyer is an explicit dry-run simulation; its generated transaction hash and service result are not blockchain transactions or a paid service response.

## Architecture

`CeloAgentBudget` models the on-chain spending bounds a Celo deployment would enforce:
- Rolling window budget enforcement in cUSD / USDC / CELO.
- `payService(serviceProvider, amount, serviceId, requestId)` enables agents to autonomously pay for 3rd-party services (APIs, inference, data) under strict cryptographic allowance limits.
- Demonstrates the policy flow relevant to the **"Buy" Track** ($1,000 pool in CELO prizes) and an x402-style HTTP payment exchange.

## Local Testing

```bash
npm run compile
npm test
npm run simulate
```

All 7/7 local EVM tests verify authorization, allowance deduction, fail-closed limit enforcement, and automatic window rollover. `npm run simulate` exercises only the dry-run buyer path.
