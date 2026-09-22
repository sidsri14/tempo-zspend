# Z-Spend — CWF Submission Text (Tempo track)

## One-liner (140-char friendly)
An agentic treasury whose budget is enforced on-chain — an AI agent that cannot
overspend, even if its own key is stolen.

## Short description (200 words max)
Z-Spend is a two-legged defense for agentic money. Leg 1, policy: fail-closed daily
per-category caps, per-recipient caps, max single payment, and a reserve floor, computed
from an immutable JSONL ledger (7/7 unit tests). Leg 2, on-chain: the agent signs as an
authorized Tempo access key wearing a pathUSD limit and scope — the protocol itself
enforces the allowance at tx validation. In our live testnet run the chain blocked the
agent's third spend even though policy approved it, because the key had exhausted its
allowance. That is the difference between software asking nicely and software that
cannot spend what it no longer has.

## Long description / "What others can build"
Wallet teams can extend the access-key model for their agent frameworks; treasury
products get a custody answer for autonomous AI spend; the policy engine is reusable as
a JSONL-verdict library on any EVM/SVM chain via treasury or access-key equivalents.

## Track
Tempo (Stripe + Paradigm payments L1). Eligible for the $100K Tempo track pool plus the
general pool and $250K accelerator consideration.

## Repo link
https://github.com/sidsri14/tempo-zspend

## Demo video
demo/z-spend-demo.mp4 — 46s, 1080p, includes live on-chain tx evidence slider deck
(Authorize → APPROVE → REJECT → blocked-by-chain). Transcript in demo/transcript.txt.

## Deck
docs/Z-Spend-CWF-Deck.pdf