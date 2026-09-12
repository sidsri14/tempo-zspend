import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_POLICY, evaluate, type SpendSnapshot, type TreasuryPolicy } from '../src/policy.js'
import { toUnits } from '../src/chain.js'

const RECIPIENT_A = '0x401a9eC6770c18AF00Fed66F8f881b4809a60472'
const RECIPIENT_B = '0xdD949650b44DF852080b5e2c93b722Fe381bAc1f'

function snap(category: Record<string, bigint>, recipient: Record<string, bigint> = {}): SpendSnapshot {
  return {
    byCategory: { engineering: 0n, marketing: 0n, ops: 0n, ...category },
    byRecipient: recipient,
  }
}

function req(over: Partial<{ id: string; category: 'engineering' | 'marketing' | 'ops'; recipient: string; amountUnits: bigint; token: string }> = {}) {
  return {
    id: 'req-1',
    category: 'ops' as const,
    recipient: RECIPIENT_A,
    amountUnits: toUnits('50.00'),
    ...over,
  }
}

test('approves spend within daily category cap', () => {
  const v = evaluate(DEFAULT_POLICY, snap({}), req())
  assert.equal(v.decision, 'APPROVE')
})

test('rejects spend exceeding a category daily cap', () => {
  const v = evaluate(DEFAULT_POLICY, snap({ ops: toUnits('260.00') }), req())
  assert.equal(v.decision, 'REJECT')
  assert.match(v.reason, /daily cap exceeded/)
})

test('fail-closed: rejects unknown category', () => {
  const v = evaluate(DEFAULT_POLICY, snap({}), req({ category: 'hr' as never }))
  assert.equal(v.decision, 'REJECT')
  assert.match(v.reason, /unknown category/)
})

test('fail-closed: rejects missing id, empty recipient, zero amount', () => {
  assert.equal(evaluate(DEFAULT_POLICY, snap({}), req({ id: '' })).decision, 'REJECT')
  assert.equal(evaluate(DEFAULT_POLICY, snap({}), req({ recipient: '' })).decision, 'REJECT')
  assert.equal(evaluate(DEFAULT_POLICY, snap({}), req({ amountUnits: 0n })).decision, 'REJECT')
  assert.equal(evaluate(DEFAULT_POLICY, snap({}), req({ amountUnits: -1n })).decision, 'REJECT')
})

test('rejects spend exceeding per-recipient daily cap', () => {
  const v = evaluate(
    DEFAULT_POLICY,
    snap({}, { [RECIPIENT_A]: toUnits('240.00') }),
    req(),
  )
  assert.equal(v.decision, 'REJECT')
  assert.match(v.reason, /per-recipient/)
})

test('rejects single payment above maxSinglePayment', () => {
  const v = evaluate(DEFAULT_POLICY, snap({}), req({ amountUnits: toUnits('250.00') }))
  assert.equal(v.decision, 'REJECT')
  assert.match(v.reason, /single payment/)
})

test('rejects disallowed token and expired policy', () => {
  assert.equal(evaluate(DEFAULT_POLICY, snap({}), req({ token: '0xdeadbeef' })).decision, 'REJECT')
  const expired: TreasuryPolicy = { ...DEFAULT_POLICY, validUntil: Math.floor(Date.now() / 1000) - 1 }
  assert.equal(evaluate(expired, snap({}), req()).decision, 'REJECT')
})