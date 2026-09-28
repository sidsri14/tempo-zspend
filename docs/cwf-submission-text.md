# Z-Spend — CWF Submission Text (Tempo track)

## One-liner (140-char friendly)
An agentic treasury whose budget is enforced on-chain — an AI agent that cannot
overspend, even if its own key is stolen.

## Short description (200 words max)
Z-Spend is a two-legged defense for agentic money. Leg 1, policy: fail-closed daily
per-category caps, per-recipient caps, max single payment, and a reserve floor, computed
from an immutable JSONL ledger (7/7 unit tests). Leg 2, on-chain: the agent signs as an
authorized Tempo access key wearing a pathUSD limit and scope — the protocol itself
enforces the allowance at tx validation. A recorded Moderato testnet run has successful
receipts for access-key authorization and an $80 pathUSD payment. When policy approved
a later $100 request after the key allowance was exhausted, the local RPC submission was
rejected before mining. That is the difference between software asking nicely and
software that cannot spend what it no longer has.

## Long description / "What others can build"
Wallet teams can extend the access-key model for their agent frameworks; treasury
products get a custody answer for autonomous AI spend; the policy engine is reusable as
a JSONL-verdict library on any EVM/SVM chain via treasury or access-key equivalents.

## Track
Tempo payments track. Confirm the exact track prize terms in the official portal before
submitting; this project does not assume a prize allocation in its description.

## Repo link
https://github.com/sidsri14/tempo-zspend

## Demo video
demo/z-spend-demo.mp4 - 46s, 1080p, showing the access-key authorization, approved
payment, policy rejection, and pre-mining limit rejection. Transcript in
demo/transcript.txt; receipt-backed transaction hashes are in the README.

## Deck
docs/Z-Spend-CWF-Deck.pdf
