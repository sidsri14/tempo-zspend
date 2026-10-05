# TEMPO Z-SPEND

**On-chain-enforced agentic treasury for [Tempo](https://tempo.xyz)** — the Stripe + Paradigm EVM L1 for payments.

Z-Spend is a spend-control agent that refuses to overrun a budget twice:

1. **Off-chain policy** — fail-closed verdicts (daily category caps, per-recipient caps, max single payment, reserve floor) evaluated from execution state recorded in a local JSONL ledger before any transaction is built.
2. **On-chain key limits (enforcement)** — the agent signs with a Tempo **account access key** that carries a real, chain-enforced `pathUSD` spending limit (`limits`) and a call scope restricted to `pathUSD.transfer` (`scopes`). Even if the agent's key is compromised, it physically cannot move more than its on-chain allowance.

Built on Tempo natively: TIP-20 stablecoins (pathUSD), no gas token, stablecoin-denominated fees, Instant Finality, access keys + call scopes (`0xAAAAAAAA...00000000`), expiring nonces, and viem SDK (`viem/tempo`).

## Getting started

```bash
npm install
npm run typecheck      # strict TS
npm test               # policy engine (off-chain gate)
npm run demo           # full on-chain demo on Moderato testnet
```

## What the demo proves

Runs against the live Moderato testnet (`chain 42431`, `rpc.moderato.tempo.xyz`):

| Step | Result |
|------|--------|
| Faucet funds root, sets pathUSD fee token | root holds pathUSD, txns pay fees in stablecoin |
| Authorize agent access key | on-chain `authorizeKey` tx, `$100/day` pathUSD limit, scope = `pathUSD.transfer`, expiry + witness |
| Root preloads agent vault `$200` | key has funds to pay from |
| `pay-001` ops `$80` | policy **APPROVE** → executed as the access key (tx hash) |
| `pay-002` marketing `$160` | policy **REJECT** (cap `$150`) |
| Read key allowance | `$19.99 / $100` remaining (the `$80` payment + fees already depleted the on-chain limit) |
| `pay-003` ops `$100` | policy passes (within caps), then the local RPC submission is rejected by the access-key limit (`0x8a9e71ea`) before a transaction is mined |
| Daily report | per-category spend vs caps, executed total |

The money story: an AI agent can have a real budget that *cannot* be exceeded at the protocol level.

## Recorded testnet evidence

The checked-in `demo/transcript.txt` is from a Moderato testnet run. The
following transactions were independently checked through the public RPC and
both returned a successful (`0x1`) receipt:

- Access-key authorization: `0xde369eedf9f6928c0335962dfa076b74299f704ec25c1db1ec6ff48617753105`
- `pay-001` pathUSD transfer: `0x9a4425e8de802eb2820709474f055242f23c64ac63c5545c296b617d24ff0e2a`

To verify them, query `eth_getTransactionReceipt` against
`https://rpc.moderato.tempo.xyz`. The over-limit `pay-003` attempt has no
receipt because it was rejected before mining; its error is recorded in the
transcript rather than presented as an on-chain transaction.

## Layout

```
src/
  chain.ts     # chain config (Moderato testnet), wallet/client factories, units
  policy.ts    # pure fail-closed policy engine -> VERDICT
  ledger.ts    # append-only .zspend/ledger.jsonl, day-bucket snapshots
  keychain.ts  # authorize access keys (limit + scope + expiry + witness), allowance reads
  treasury.ts  # fund/prepare, propose, execute, report
demo/run-demo.ts   # end-to-end transcript on testnet
test/policy.test.ts
```

## Wiring your own policy

```ts
import { DEFAULT_POLICY, evaluate } from './src/policy.js'

// policy caps live in policy.ts/DEFAULT_POLICY; override per deployment:
const policy = {
  ...DEFAULT_POLICY,
  categoryDailyCaps: { ...DEFAULT_POLICY.categoryDailyCaps, ops: toUnits('5.00') },
}

const verdict = evaluate(policy, todaySnapshot(), request) // APPROVE | REJECT
```

## Notes

- Fees count toward a key's on-chain limit — the limit is strict, fees included.
- The faucet re-funds freely on testnet; the wallet (`.zspend/wallet.json`) is persisted locally with `0600` perms and never printed.
- Requires Node ≥ 20 and the latest `viem` (Tempo support is first-class).

## Live Control Plane Dashboard

The interactive web control plane is live on GitHub Pages:
👉 **[sidsri14.github.io/tempo-zspend](https://sidsri14.github.io/tempo-zspend/)**

Features real-time policy visualization, allowance deduction, simulation adapter, and fail-closed state tracking.

## Multi-Chain Modules

- **[`monad/`](monad/)** — Native-MON rolling budget guard for Monad Metropolis Hackathon (7/7 EVM tests passing).
- **[`celo/`](celo/)** — Autonomous agent service payer for Celo Agents on Open Rails Hackathon (7/7 EVM tests passing, x402 HTTP micropayment simulation).
- **[`bsc/`](bsc/)** — Tokenized stocks risk monitor for BNB Hack (7/7 EVM tests passing).
- **[`arc/`](arc/)** — Microgrants agent budget contract on Arc Network (7/7 EVM tests passing).
- **[`stylus/`](stylus/)** — Arbitrum Stylus native Rust WASM spend firewall (6/6 Rust unit tests passing).

## CWF 2026

Prepared for the Crypto World's Fair **Tempo track** (Project #14492). Saved and verified in portal; submission window opens October 6, 2026 at 4:00 AM PDT (16:30 IST).
