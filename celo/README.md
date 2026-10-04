# Z-Spend Celo — Agents on Open Rails Hackathon

Autonomous agent service payer and spend-guard on Celo payment rails.

## Architecture

`CeloAgentBudget` enforces on-chain spending bounds on Celo:
- Rolling window budget enforcement in cUSD / USDC / CELO.
- `payService(serviceProvider, amount, serviceId, requestId)` enables agents to autonomously pay for 3rd-party services (APIs, inference, data) under strict cryptographic allowance limits.
- Supports the **"Buy" Track** ($1,000 pool in CELO prizes) and **x402 HTTP micropayment protocol**.

## Local Testing

```bash
npm run compile
npm test
npm run simulate
```

All 7/7 local EVM tests verify authorization, allowance deduction, fail-closed limit enforcement, and automatic window rollover.
