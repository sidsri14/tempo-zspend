# Z-Spend — Colosseum CWF Submission Checklist (Oct 12, 2026)

> **Rule check:** Colosseum allows ONE submission per builder (CWF FAQ). We submit Z-Spend only.
> All other CWF-ready projects (StealthShield, Selene, Rate Limiter) stay for their OTHER bounties.

## 0. Login
1. Go to https://colosseum.com/worldsfair → **Enter the Arena**.
2. Sign in with **GitHub** (@sidsri14) — authenticated git identity makes repo access trivial for judges.

## 1. Profile / team details
- Team name: **Z-Spend** (or "sidsri14")
- Location: **Lucknow, India**
- Links: GitHub https://github.com/sidsri14 · X @sidsri14 (or leave blank if not posting)

## 2. Project description (paste)
Use `docs/cwf-submission-text.md` (One-liner + Short description). Trim the Long-description
section to fit the "What can others build on this" box.

## 3. GitHub repository (required, public)
```
https://github.com/sidsri14/tempo-zspend
```
Already public. **Confirm from an incognito window** that docs/ and demo/ files open without login.

## 4. Presentation video — 2–3 min ("the why")
Use `demo/frames/slide-01.png … slide-07.png` as title cards between narration takes.
Record narration in one pass over a slideshow of the frames (any loom/OBS/screen recorder).
Script below = ~2:30.

### Slides → narration mapping
| Frame | Narration (~2:30 total) |
|---|---|
| slide-01 (title) | "Z-Spend: an agentic treasury whose budget is enforced on-chain — an AI agent that physically cannot overspend, even if its own key is stolen." |
| slide-02 (problem) | "Agentic AI now holds and spends real money, but 'trust the agent' fails. Multisigs don't scale to autonomy; a misconfigured or stolen key can drain everything." |
| slide-03 (solution) | "Two legs of defense. Leg one — a fail-closed policy engine: per-category daily caps, per-recipient caps, a max single payment, and a reserve floor, computed from an immutable ledger." |
| slide-04 (on-chain) | "Leg two — the chain itself. The agent signs as a native Tempo access key with a $100/day pathUSD limit and a transfer scope. Tempo's protocol enforces it at transaction validation." |
| slide-05 (live proof) | "This is not a mock. On Tempo testnet the running ledger shows: $80 ops paid; $160 marketing rejected by policy; then pay-003 — policy said OK, but the key had hit its limit and **the chain reverted it**: that is the on-chain guarantee holding." |
| slide-06 (market) | "Who needs this? DeFi treasuries, DAOs, autonomous trading agents, AI payment agents, payroll bots. Any place an algorithm moves money and needs a hard ceiling." |
| slide-07 (closing) | "The difference between software that asks nicely and software that cannot spend what it no longer has. Z-Spend — native to Tempo, live on testnet, ready to harden for mainnet." |

### Render hint
- 1080p, h264, <2:30, <25 MB. Loom / YouTube unlisted are both accepted.

## 5. Product demo video — max 3 min ("the how")
Already done: `demo/z-spend-demo.mp4` (46s, 1080p h264, verified). Upload the SAME file — it
is exactly the "working demo" slot. No changes needed.
- If you want a longer build: replay `npm run demo` (tsx demo/run-demo.ts) at 120-col dark
  terminal and record that run; the transcript.txt documents every tx hash.

## 6. GTM / docs (any free-text fields)
Paste: "Open repo, MIT-licensed, one-builder team. Next: mainnet Tempo deployment, multi-wallet
collaboration, and a policy-simulator dashboard for treasury teams. Ask: track prize +
accelerator consideration."

## 7. Prior-work disclosure (required, mandatory checkbox)
Colosseum disqualifies teams that hide pre-existing work. Disclose honestly:
"Core built during the CWF window (Sept 14–Oct 12); early prototype and testnet verification
predate the window. Prior work fully available in the public repo." — disclosure is cheap, hiding it costs everything.

## 8. Optional weekly update video (Colosseum says ~88% of winners had video; weekly updates are "cheapest evidence of momentum")
If submitting early: record ONE 1-min progress update before Oct 12 ("what I changed this
week") and attach if the form allows. Optional — adds momentum signal.

## 9. Final self-check before Submit
- [ ] Repo public, opens logged-out
- [ ] Presentation video plays, audible, ≤3 min
- [ ] Demo video (46s) plays in browser
- [ ] Description pasted from cwf-submission-text.md
- [ ] Prior-work disclosure checked
- [ ] Press Submit; keep the confirmation (screenshot or email)

## Deadline
**Oct 12, 2026, (likely ~11:59pm ET).** Submit early (ideally this week) once videos are up.