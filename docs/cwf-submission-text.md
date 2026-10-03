# Z-Spend - CWF Submission Text (Tempo track)

## One-liner

An agentic treasury whose spending limit is enforced on-chain, so an agent
cannot exceed its configured allowance even if its access key is compromised.

## Short description

Z-Spend is a two-layer control for agentic payments on Tempo. The local policy
engine fail-closes requests that exceed a daily category cap, a per-recipient
cap, a maximum single-payment amount, or a reserve floor. It records execution
state in a local JSONL ledger and has seven focused policy tests.

The second layer is Tempo's on-chain access-key enforcement. The demo authorizes
an access key with a pathUSD spending limit and a `pathUSD.transfer` scope. The
checked-in Moderato testnet transcript records a successful authorization and an
$80 pathUSD payment. It also records a later $100 request that passed the local
policy but was rejected by the RPC before mining because the access-key
allowance was exhausted.

This gives builders a concrete boundary between application policy and a
protocol-enforced limit. The repository includes the code, testnet receipt
references, transcript, and short demo video.

## What others can build

Wallet and treasury teams can adapt the policy evaluation layer to their own
agent framework, while using access-key or equivalent protocol controls to give
autonomous spend a hard on-chain ceiling.

## Track

Tempo. Confirm the exact track selection and live terms in the official portal
before submitting.

## Links

- Repository: https://github.com/sidsri14/tempo-zspend
- Product demo: `demo/z-spend-demo.mp4` (46 seconds)
- Testnet evidence: `demo/transcript.txt` and the README receipt references
- Deck: `docs/Z-Spend-CWF-Deck.pdf`
