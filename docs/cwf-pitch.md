# Z-Spend — Crypto World's Fair submission (Tempo track)

## One-liner

An agentic treasury on Tempo whose budget is enforced **on-chain** by access-key spending limits — an AI agent that cannot overspend, even if its own key is stolen.

## Why Tempo

- Tempo = Stripe + Paradigm L1 for payments: stablecoin-native (no gas token), sub-half-cent fees, instant finality, native account abstraction.
- $100K split across Tempo track top 10; general pool top 21; $250K accelerator. Low competition — most of the 1,057 builders are Solana-native; the ecosystem is being actively seeded and judges reward native usage.
- Native **access keys** (`0xAAAAAAAA...00000000`, TIP-1011): per-token spending limits + call scopes + expiry + witness revocation, all enforced by the protocol at tx validation.

## The build (2 legs of defense)

1. **Policy (off-chain, fail-closed)**: daily per-category caps, per-recipient caps, max single payment, reserve floor. Every spend is a verdict computed from an immutable JSONL ledger. Unit-tested (7/7).
2. **On-chain enforcement**: the agent signs as an authorized access key wearing `pathUSD` limit `$100/day` + scope = `pathUSD.transfer`. Compromise the key → still can't exceed the allowance.

## Live evidence (Moderato testnet, real txs)

| Step | Result |
|---|---|
| Authorize agent key (`$100/day`, scoped) | on-chain `authorizeKey` tx |
| `pay-001` ops `$80` | policy APPROVE → executed via access key |
| `pay-002` marketing `$160` | policy REJECT (cap `$150`) |
| `pay-003` ops `$100` (policy OK, key exhausted) | **blocked by chain** — revert `0x8a9e71ea` |
| Remaining allowance read | `$19.99 / $100` — fees included |

## Why we win

- **Native, not fake**: uses Tempo's actual primitives (TIP-20 `pathUSD`, account keychain, scopes) — judges see protocol-level understanding, not a port.
- **The demo has teeth**: a real "agent tried to pay `$100`, wallet had `$19.99`, the chain refused" moment.
- **Market fit**: every stablecoin treasury wants agent budgets; Tempo charges fractional-cent fees so enforcement is *cheaper than any auditor*.

## Repo + run

```bash
cd tempo-zspend
npm install && npm test      # policy engine
npm run demo                 # full live demo on Moderato testnet
```

Chain: `42431` (Moderato) · RPC `https://rpc.moderato.tempo.xyz` · pathUSD `0x20c0...0000` · keychain `0xAAAA...0000`.

## Demo script (video, <3 min)

1. Boot: show policy (caps table) + fresh wallet on explorer.
2. Fund: faucet → pathUSD balance.
3. Authorize key: `authorizeKey` with limit `$100/day` + scope `pathUSD.transfer` (show tx hash block).
4. Pay `$80`: policy APPROVE, tx mined.
5. Try `$160` marketing: REJECT, reason printed.
6. Read allowance `$19.99/$100`, then attempt `$100` → chain reverted `0x8a9e71ea`.
7. Report screen. Close on the tagline.

## Next for bigger prizes

- Add a Telegram/WhatsApp agent loop for "request budget" approval flow (uses same policy engine).
- Multi-owner root (`nativeMultisig`) for high-value keys.
- On-chain issuer hook: drip the weekly allowance *from* the treasury so the vault itself never moves.