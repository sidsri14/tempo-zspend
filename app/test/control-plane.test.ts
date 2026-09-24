import test from 'node:test'
import assert from 'node:assert'
import { SimAdapter } from '../src/adapters/sim'
import { evaluate, DEFAULT_POLICY, usd, type SpendRequest, type SpendSnapshot } from '@zspend/policy'

const empty: SpendSnapshot = {
  byCategory: { ops: 0n, marketing: 0n, engineering: 0n },
  byRecipient: {},
}

function req(id: string, category: ('ops' | 'marketing' | 'engineering')[], amount: string): SpendRequest {
  return {
    id,
    category: category[0],
    recipient: 'grants.' + category[0],
    amountUnits: BigInt(Math.round(parseFloat(amount) * 1e6)),
    memo: 'test',
  }
}

test('control-plane: policy approve → chain confirm', async () => {
  const a = new SimAdapter()
  await a.authorize({ name: 'agent-ops', limitUnits: BigInt('100000000'), periodSeconds: 86400, scope: 'transfer' })
  const r = req('pay-001', ['ops'], '80')
  const verdict = evaluate(DEFAULT_POLICY, empty, r)
  assert.equal(verdict.decision, 'APPROVE')
  const receipt = await a.execute(r.id, r.amountUnits)
  assert.equal(receipt.confirmed, true)
  const { remainingUnits } = await a.allowance()
  assert.equal(usd(remainingUnits), '$20.000000')
})

test('control-plane: policy reject (marketing cap)', async () => {
  const a = new SimAdapter()
  await a.authorize({ name: 'agent-ops', limitUnits: BigInt('100000000'), periodSeconds: 86400, scope: 'transfer' })
  const r = req('pay-002', ['marketing'], '160')
  const verdict = evaluate(DEFAULT_POLICY, empty, r)
  assert.equal(verdict.decision, 'REJECT')
})

test('control-plane: approved but chain-blocked when key exhausted', async () => {
  const a = new SimAdapter()
  await a.authorize({ name: 'agent-ops', limitUnits: BigInt('100000000'), periodSeconds: 86400, scope: 'transfer' })
  const r1 = req('pay-001', ['ops'], '80')
  assert.equal(evaluate(DEFAULT_POLICY, empty, r1).decision, 'APPROVE')
  await a.execute(r1.id, r1.amountUnits)
  const r3 = req('pay-003', ['ops'], '100')
  assert.equal(evaluate(DEFAULT_POLICY, empty, r3).decision, 'APPROVE')
  const receipt = await a.execute(r3.id, r3.amountUnits)
  assert.equal(receipt.confirmed, false)
  assert.match(receipt.txHash ?? '', /chain-block/)
})