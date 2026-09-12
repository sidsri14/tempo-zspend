# TEMPO Z-SPEND

**On-chain-enforced agentic treasury for [Tempo](https://tempo.xyz)** — the Stripe + Paradigm EVM L1 for payments.

Z-Spend is a spend-control agent that refuses to overrun a budget twice:

1. **Off-chain policy** — fail-closed verdicts (daily category caps, per-recipient caps, max single payment, reserve floor) evaluated against an append-only ledger before any tx is built.
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

Runs against the live Modero testnet (`chain 42431`, `rpc.moderato.tempo.xyz`):

| Step | Result |
|------|--------|
| Faucet funds root, sets pathUSD fee token | root holds pathUSD, txns pay fees in stablecoin |
| Authorize agent access key | on-chain `authorizeKey` tx, `$100/day` pathUSD limit, scope = `pathUSD.transfer`, expiry + witness |
| Root preloads agent vault `$200` | key has funds to pay from |
| `pay-001` ops `$80` | policy **APPROVE** → executed as the access key (tx hash) |
| `pay-002` marketing `$160` | policy **REJECT** (cap `$150`) |
| Read key allowance | `$19.99 / $100` remaining (the `$80` payment + fees already depleted the on-chain limit) |
| `pay-003` ops `$100` | policy passes (within caps), on-chain **keychain revert `0x8a9e71ea`** — the key's limit is exhausted |
| Daily report | per-category spend vs caps, executed total |

The money story: an AI agent can have a real budget that *cannot* be exceeded at the protocol level.

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

## CWF 2026

Submitted to the Crypto World's Fair **Tempo track** — a 1,057-builder hackathon where Tempo is being seeded. Tempo + agentic payments = the demo the judges want to see.