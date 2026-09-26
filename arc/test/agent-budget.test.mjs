import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createVM } from '@ethereumjs/vm'
import { createAddressFromString, createZeroAddress, hexToBytes, bytesToHex } from '@ethereumjs/util'
import { encodeFunctionData, encodeDeployData, decodeFunctionResult, decodeErrorResult } from 'viem'

const load = (n) => JSON.parse(readFileSync(new URL(`../artifacts/${n}.json`, import.meta.url), 'utf8'))
const AB = load('AgentBudget')
const USDC = load('MockUSDC')

const USDC_UNIT = 10n ** 6n
const usd = (n) => n * USDC_UNIT

const OWNER = createAddressFromString('0x1000000000000000000000000000000000000001')
const AGENT = createAddressFromString('0x2000000000000000000000000000000000000002')
const PAYEE = createAddressFromString('0x3000000000000000000000000000000000000003')
const STRANGER = createAddressFromString('0x4000000000000000000000000000000000000004')

const now = 1_790_000_000n
const blockAt = (t) => ({
  header: {
    number: 1n,
    coinbase: createZeroAddress(),
    timestamp: t,
    difficulty: 0n,
    prevRandao: new Uint8Array(32),
    gasLimit: 30_000_000n,
    baseFeePerGas: 0n,
  },
})

async function setup({ window = 86_400n, t = now } = {}) {
  const vm = await createVM()

  const deploy = async (art, args, caller = OWNER) => {
    const data = encodeDeployData({ abi: art.abi, bytecode: art.bytecode, args })
    const r = await vm.evm.runCall({ caller, data: hexToBytes(data), gasLimit: 10_000_000n, block: blockAt(t) })
    assert.equal(r.execResult.exceptionError, undefined, `deploy failed: ${r.execResult.exceptionError?.error}`)
    return r.createdAddress
  }

  const call = async (to, art, functionName, args, { caller = OWNER, time = t } = {}) => {
    const data = encodeFunctionData({ abi: art.abi, functionName, args })
    return vm.evm.runCall({ caller, to, data: hexToBytes(data), gasLimit: 5_000_000n, block: blockAt(time) })
  }

  const read = async (to, art, functionName, args = [], opts = {}) => {
    const r = await call(to, art, functionName, args, opts)
    assert.equal(r.execResult.exceptionError, undefined)
    return decodeFunctionResult({ abi: art.abi, functionName, data: bytesToHex(r.execResult.returnValue) })
  }

  const expectRevert = async (promise, art, errorName) => {
    const r = await promise
    assert.ok(r.execResult.exceptionError, 'expected a revert, call succeeded')
    const data = bytesToHex(r.execResult.returnValue)
    const decoded = decodeErrorResult({ abi: art.abi, data })
    assert.equal(decoded.errorName, errorName, `expected ${errorName}, got ${decoded.errorName ?? data}`)
    return decoded.args
  }

  const usdc = await deploy(USDC, [])
  const budget = await deploy(AB, [usdc.toString(), window])

  return { vm, usdc, budget, call, read, expectRevert, deploy }
}

test('deploy + fund treasury with USDC', async () => {
  const { usdc, budget, call, read } = await setup()
  await call(usdc, USDC, 'mint', [budget.toString(), usd(1000n)])
  assert.equal(await read(usdc, USDC, 'balanceOf', [budget.toString()]), usd(1000n))
  assert.equal(await read(budget, AB, 'window'), 86_400n)
  assert.equal(await read(budget, AB, 'usdcBalance'), usd(1000n))
})

test('agent spends within budget: funds move, remaining shrinks', async () => {
  const { usdc, budget, call, read } = await setup()
  await call(usdc, USDC, 'mint', [budget.toString(), usd(1000n)])
  await call(budget, AB, 'authorize', [AGENT.toString(), usd(100n)])

  const r = await call(budget, AB, 'spend', [PAYEE.toString(), usd(80n)], { caller: AGENT })
  assert.equal(r.execResult.exceptionError, undefined)

  assert.equal(await read(usdc, USDC, 'balanceOf', [PAYEE.toString()]), usd(80n))
  assert.equal(await read(budget, AB, 'remaining', [AGENT.toString()]), usd(20n))
  assert.equal(await read(budget, AB, 'usdcBalance'), usd(920n))
})

test('over-budget spend reverts ExceedsRemaining (fail-closed, no partial)', async () => {
  const { usdc, budget, call, read, expectRevert } = await setup()
  await call(usdc, USDC, 'mint', [budget.toString(), usd(1000n)])
  await call(budget, AB, 'authorize', [AGENT.toString(), usd(100n)])
  await call(budget, AB, 'spend', [PAYEE.toString(), usd(80n)], { caller: AGENT })

  const [requested, left] = await expectRevert(
    call(budget, AB, 'spend', [PAYEE.toString(), usd(30n)], { caller: AGENT }),
    AB,
    'ExceedsRemaining',
  )
  assert.equal(requested, usd(30n))
  assert.equal(left, usd(20n))
  assert.equal(await read(usdc, USDC, 'balanceOf', [PAYEE.toString()]), usd(80n))
  assert.equal(await read(budget, AB, 'remaining', [AGENT.toString()]), usd(20n))
})

test('unauthorized caller reverts AgentInactive', async () => {
  const { usdc, budget, call, expectRevert } = await setup()
  await call(usdc, USDC, 'mint', [budget.toString(), usd(1000n)])
  await expectRevert(
    call(budget, AB, 'spend', [PAYEE.toString(), usd(1n)], { caller: STRANGER }),
    AB,
    'AgentInactive',
  )
})

test('revoked agent can no longer spend', async () => {
  const { usdc, budget, call, read, expectRevert } = await setup()
  await call(usdc, USDC, 'mint', [budget.toString(), usd(1000n)])
  await call(budget, AB, 'authorize', [AGENT.toString(), usd(100n)])
  await call(budget, AB, 'spend', [PAYEE.toString(), usd(10n)], { caller: AGENT })

  await call(budget, AB, 'revoke', [AGENT.toString()])
  assert.equal(await read(budget, AB, 'remaining', [AGENT.toString()]), 0n)
  await expectRevert(
    call(budget, AB, 'spend', [PAYEE.toString(), usd(1n)], { caller: AGENT }),
    AB,
    'AgentInactive',
  )
})

test('only owner can authorize', async () => {
  const { usdc, budget, call, expectRevert } = await setup()
  await call(usdc, USDC, 'mint', [budget.toString(), usd(1000n)])
  await expectRevert(
    call(budget, AB, 'authorize', [STRANGER.toString(), usd(100n)], { caller: STRANGER }),
    AB,
    'NotOwner',
  )
})

test('window rollover resets spend allowance', async () => {
  const t0 = now
  const { usdc, budget, call, read } = await setup({ window: 60n, t: t0 })
  await call(usdc, USDC, 'mint', [budget.toString(), usd(1000n)])
  await call(budget, AB, 'authorize', [AGENT.toString(), usd(100n)])

  await call(budget, AB, 'spend', [PAYEE.toString(), usd(100n)], { caller: AGENT })
  assert.equal(await read(budget, AB, 'remaining', [AGENT.toString()]), 0n)

  const later = t0 + 120n
  assert.equal(await read(budget, AB, 'remaining', [AGENT.toString()], { time: later }), usd(100n))
  const r = await call(budget, AB, 'spend', [PAYEE.toString(), usd(40n)], { caller: AGENT, time: later })
  assert.equal(r.execResult.exceptionError, undefined, 'post-rollover spend should succeed')
  assert.equal(await read(usdc, USDC, 'balanceOf', [PAYEE.toString()]), usd(140n))
  assert.equal(await read(budget, AB, 'remaining', [AGENT.toString()], { time: later }), usd(60n))
})