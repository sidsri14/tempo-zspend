# Z-Spend Celo - Agent Spend Policy Prototype

This package contains a local Celo agent-budget contract and a prepared x402 seller
API for charging for policy-evaluation requests. It is not deployed to Celo. No live
payment, API-key creation, third-party service purchase, or mainnet settlement has
been performed from this repository.

## What Is Implemented

`CeloAgentBudget` models the on-chain spending bounds a Celo deployment would enforce:

- Rolling-window budget enforcement for an authorized agent.
- `payService(serviceProvider, amount, serviceId, requestId)` to move a supported
  token only while the agent remains inside its owner-set limit.
- Fail-closed revocation and window rollover behavior, covered by local EVM tests.

The `x402/` package is a seller-side HTTP API prepared for Celo's hosted x402
facilitator. `POST /v1/policy/quote` is protected by an exact-price payment
requirement; `GET /health` is public. The default testnet route uses Celo Sepolia
USDC. On mainnet, the supported asset must be configured explicitly; `USAT` uses the
correct `Tether America USD` EIP-712 domain.

The protected handler intentionally returns only a conservative syntax-level policy
decision today. It does not claim to read an on-chain budget or purchase a third-party
service until those integrations and their settlement evidence exist.

## Local Verification

```bash
npm run compile
npm run test:all
npm audit --omit=dev --audit-level=high
```

The suite currently covers seven contract tests and five x402 configuration/protocol
tests. The protocol test verifies that the paid endpoint emits HTTP 402 and a
machine-readable `payment-required` header without making an external settlement.

## Testnet Setup

The facilitator key is created by the wallet owner at https://x402.celo.org. Never
commit it, expose it to a browser, or share a wallet private key.

```bash
# Celo Sepolia; price is 10,000 USDC atomic units ($0.01).
$env:X402_API_KEY = 'x402_...'
$env:SELLER_PAY_TO = '0xYourWalletAddress'
$env:X402_NETWORK = 'testnet'
$env:X402_PRICE_ATOMIC = '10000'
npm run serve:x402
```

For a mainnet USAT route, set `X402_NETWORK=mainnet` and `X402_ASSET=USAT` only after
the testnet end-to-end payment has been verified. A 402 response is not proof of a
settled payment; production evidence requires a successful facilitator response and
the corresponding on-chain settlement.

## Existing Dry Run

```bash
npm run simulate
```

`agent_service_buyer.mjs` remains an explicit local dry-run. Its generated transaction
hash and service result are not blockchain transactions or paid service responses.
