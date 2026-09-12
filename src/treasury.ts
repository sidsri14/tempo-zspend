import { Abis, Actions } from 'viem/tempo'
import { type Address } from 'viem'
import { PATHUSD, toUnits, type TempoWalletClient, type TempoPublicClient } from './chain.js'
import {
  DEFAULT_POLICY,
  evaluate,
  reserveCheck,
  usd,
  type SpendRequest,
  type TreasuryPolicy,
  type Verdict,
} from './policy.js'
import { append, todaySnapshot, type LedgerEntry } from './ledger.js'

export interface ExecutionResult {
  verdict: Verdict
  txHash?: Address
}

/** Fund a fresh wallet through the testnet faucet, then set pathUSD as its fee token. */
export async function fundAndPrepare(client: TempoWalletClient) {
  const account: Address = (client.account as unknown as { address: Address }).address
  await Actions.faucet.fundSync(client, { account, timeout: 120_000 })
  await Actions.fee.setUserToken(client, { token: PATHUSD })
}

export function makePayment(
  id: string,
  category: SpendRequest['category'],
  recipient: Address,
  amountUsd: string,
  memo?: string,
): SpendRequest {
  return { id, category, recipient, amountUnits: toUnits(amountUsd), memo }
}

/** Off-chain policy gate: ledger snapshot + policy -> verdict. */
export function propose(policy: TreasuryPolicy, req: SpendRequest): Verdict {
  const snapshot = todaySnapshot()
  const v = evaluate(policy, snapshot, req)
  append(toEntry(v))
  return v
}

/** Send a pathUSD transfer from the given signer. */
async function transferWith(client: TempoWalletClient, recipient: Address, amountUnits: bigint): Promise<Address> {
  return client.writeContract({
    address: PATHUSD,
    abi: Abis.tip20,
    functionName: 'transfer',
    args: [recipient, amountUnits],
  })
}

/** Execute an already-APPROVED spend: reserve check, then on-chain transfer. */
export async function executeApproved(
  client: TempoWalletClient,
  policy: TreasuryPolicy,
  req: SpendRequest,
  balanceUnits: bigint,
): Promise<ExecutionResult> {
  const reserve = reserveCheck(policy, balanceUnits, req)
  if (reserve.decision !== 'APPROVE') {
    append(toEntry(reserve))
    return { verdict: reserve }
  }

  const txHash = await transferWith(client, req.recipient as Address, req.amountUnits)
  const approved: LedgerEntry = {
    id: req.id,
    ts: Date.now(),
    category: req.category,
    recipient: req.recipient,
    amountUnits: req.amountUnits.toString(),
    token: req.token ?? PATHUSD,
    verdict: 'APPROVE',
    reason: `executed on-chain (tx ${txHash})`,
    txHash,
    executed: true,
  }
  append(approved)
  return { verdict: { decision: 'APPROVE', request: req, reason: `tx ${txHash}` }, txHash }
}

function toEntry(verdict: Verdict): LedgerEntry {
  return {
    id: verdict.request.id,
    ts: Date.now(),
    category: verdict.request.category,
    recipient: verdict.request.recipient,
    amountUnits: verdict.request.amountUnits.toString(),
    token: verdict.request.token ?? PATHUSD,
    verdict: verdict.decision,
    reason: verdict.reason,
  }
}

export async function balanceOf(client: TempoPublicClient, account: Address): Promise<bigint> {
  const res = await client.readContract({
    address: PATHUSD,
    abi: Abis.tip20,
    functionName: 'balanceOf',
    args: [account],
  })
  return res as bigint
}

export function printReport(policy: TreasuryPolicy) {
  const cells = todaySnapshot()
  console.log('\n=== daily treasury report ===')
  const total = Object.values(cells.byCategory).reduce((a, b) => a + b, 0n)
  for (const [cat, cap] of Object.entries(policy.categoryDailyCaps)) {
    const spent = cells.byCategory[cat as keyof typeof cells.byCategory] ?? 0n
    console.log(`  ${cat.padEnd(12)} ${usd(spent).padStart(12)} / ${usd(cap).padStart(12)}  ${pct(spent, cap)} used`)
  }
  console.log(`  total spend today: ${usd(total)}`)
  console.log(`  per-recipient cap: ${usd(policy.perRecipientDailyCapUnits)}`)
}

function pct(a: bigint, b: bigint): string {
  if (b === 0n) return 'n/a'
  return `${Number((a * 10000n) / b) / 100}%`
}

export { DEFAULT_POLICY }