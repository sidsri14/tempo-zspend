import { DECIMALS, fromUnits, PATHUSD } from './chain.js'

export type Category = 'engineering' | 'marketing' | 'ops'

export interface SpendLimit {
  category: Category
  dailyCapUnits: bigint
}

export interface TreasuryPolicy {
  version: number
  /** Per-category daily caps (in 6-decim. units). */
  categoryDailyCaps: Record<Category, bigint>
  /** Per-recipient daily cap (units). */
  perRecipientDailyCapUnits: bigint
  /** Maximum size of a single payment (units). 0 = unlimited. */
  maxSinglePaymentUnits: bigint
  /** Minimum treasury reserve kept untouched (basis points, e.g. 500 = 5%). 0 = off. */
  minReserveBps: number
  /** Allowed payout tokens (only TIP-20 that the agent may pay). */
  allowedTokens: string[]
  /** Hard stop timestamp (epoch secs) after which nothing can be spent. 0 = never. */
  validUntil: number
}

export interface SpendRequest {
  id: string
  category: Category
  recipient: string
  amountUnits: bigint
  token?: string
  memo?: string
}

export type Verdict =
  | { decision: 'APPROVE'; request: SpendRequest; reason: string }
  | { decision: 'REJECT'; request: SpendRequest; reason: string }

/** Daily spend buckets derived from the transaction ledger, keyed by (category | recipient). */
export interface SpendSnapshot {
  byCategory: Record<Category, bigint>
  byRecipient: Record<string, bigint>
}

export const DEFAULT_POLICY: TreasuryPolicy = {
  version: 1,
  categoryDailyCaps: {
    engineering: 200n * 10n ** DECIMALS,
    marketing: 150n * 10n ** DECIMALS,
    ops: 300n * 10n ** DECIMALS,
  },
  perRecipientDailyCapUnits: 250n * 10n ** DECIMALS,
  maxSinglePaymentUnits: 100n * 10n ** DECIMALS,
  minReserveBps: 500,
  allowedTokens: [PATHUSD],
  validUntil: 0,
}

/**
 * Evaluate a spend request against policy + ledger state.
 * Fail-closed: any undefined input, unknown category, disallowed token,
 * missing request id, or empty recipient is rejected.
 */
export function evaluate(
  policy: TreasuryPolicy,
  snapshot: SpendSnapshot,
  request: SpendRequest,
): Verdict {
  const token = request.token ?? PATHUSD

  if (!request.id || request.id.trim() === '') {
    return reject(request, 'missing request id')
  }
  if (!policy.allowedTokens.includes(token)) {
    return reject(request, `token ${token} not in allowedTokens`)
  }
  const cap = policy.categoryDailyCaps[request.category]
  if (cap === undefined) {
    return reject(request, `unknown category '${request.category}'`)
  }
  if (!request.recipient || request.recipient.trim() === '') {
    return reject(request, 'empty recipient')
  }
  if (!request.amountUnits || request.amountUnits <= 0n) {
    return reject(request, `non-positive amount ${fromUnits(request.amountUnits)}`)
  }
  if (policy.validUntil > 0 && Date.now() / 1000 > policy.validUntil) {
    return reject(request, 'policy expired')
  }

  const categorySpent = snapshot.byCategory[request.category] ?? 0n
  const categoryRemaining = cap - categorySpent
  if (request.amountUnits > categoryRemaining) {
    return reject(
      request,
      `category '${request.category}' daily cap exceeded: spent ${usd(categorySpent)}, tried ${usd(request.amountUnits)}, cap ${usd(cap)}, remaining ${usd(categoryRemaining)}`,
    )
  }

  const recipientSpent = snapshot.byRecipient[request.recipient] ?? 0n
  const recipientRemaining = policy.perRecipientDailyCapUnits - recipientSpent
  if (request.amountUnits > recipientRemaining) {
    return reject(
      request,
      `per-recipient daily cap exceeded: spent ${usd(recipientSpent)}, tried ${usd(request.amountUnits)}, cap ${usd(policy.perRecipientDailyCapUnits)}`,
    )
  }

  if (policy.maxSinglePaymentUnits > 0n && request.amountUnits > policy.maxSinglePaymentUnits) {
    return reject(
      request,
      `single payment larger than max (${usd(request.amountUnits)} > ${usd(policy.maxSinglePaymentUnits)})`,
    )
  }

  return approve(
    request,
    `OK (reserve ${policy.minReserveBps}bps; category remaining ${usd(categoryRemaining)})`,
  )
}

/** Check the treasury can absorb the payment without dipping below the reserve floor. */
export function reserveCheck(policy: TreasuryPolicy, balanceUnits: bigint, request: SpendRequest): Verdict {
  if (policy.minReserveBps <= 0) return approve(request, 'reserve check disabled')
  const reserve = (balanceUnits * BigInt(policy.minReserveBps)) / 10000n
  if (request.amountUnits > balanceUnits - reserve) {
    return reject(
      request,
      `reserve floor would be breached: balance ${usd(balanceUnits)}, reserve ${usd(reserve)}, payment ${usd(request.amountUnits)}`,
    )
  }
  return approve(request, `reserve OK (floor ${usd(reserve)})`)
}

function approve(request: SpendRequest, reason: string): Verdict {
  return { decision: 'APPROVE', request, reason }
}

function reject(request: SpendRequest, reason: string): Verdict {
  return { decision: 'REJECT', request, reason }
}

export function usd(units: bigint): string {
  return `$${fromUnits(units)}`
}