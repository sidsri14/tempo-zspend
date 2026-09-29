import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createVM } from '@ethereumjs/vm'
import { createAddressFromString, createZeroAddress, hexToBytes, bytesToHex } from '@ethereumjs/util'
import { encodeFunctionData, encodeDeployData, decodeFunctionResult, decodeErrorResult } from 'viem'

const load = (n) => JSON.parse(readFileSync(new URL(`../artifacts/${n}.json`, import.meta.url), 'utf8'))
const AB = load('AgentBudgetBSC')
const TOKEN = load('MockBEP20')

const UNIT = 10n ** 18n
const toUnits = (n) => n * UNIT

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

  const tokenAddr = await deploy(TOKEN, ['Mock Binance USD', 'USDT', 18])
  const budgetAddr = await deploy(AB, [bytesToHex(tokenAddr.bytes), window])

  // Mint 10,000 USDT to budget contract
  await call(tokenAddr, TOKEN, 'mint', [bytesToHex(budgetAddr.bytes), toUnits(10_000n)])

  return { vm, tokenAddr, budgetAddr, deploy, call, read, expectRevert }
}

test('AgentBudgetBSC — authorization and remaining budget view', async () => {
  const { budgetAddr, call, read } = await setup()

  await call(budgetAddr, AB, 'authorizeAgent', [bytesToHex(AGENT.bytes), toUnits(500n)])
  const [remaining, expiresAt] = await read(budgetAddr, AB, 'getRemainingBudget', [bytesToHex(AGENT.bytes)])

  assert.equal(remaining, toUnits(500n))
  assert.equal(expiresAt, now + 86_400n)
})

test('AgentBudgetBSC — execution moves tokens and decrements budget', async () => {
  const { budgetAddr, tokenAddr, call, read } = await setup()

  await call(budgetAddr, AB, 'authorizeAgent', [bytesToHex(AGENT.bytes), toUnits(500n)])

  const r = await call(budgetAddr, AB, 'spend', [bytesToHex(PAYEE.bytes), toUnits(150n)], { caller: AGENT })
  assert.equal(r.execResult.exceptionError, undefined)

  const payeeBal = await read(tokenAddr, TOKEN, 'balanceOf', [bytesToHex(PAYEE.bytes)])
  assert.equal(payeeBal, toUnits(150n))

  const [remaining] = await read(budgetAddr, AB, 'getRemainingBudget', [bytesToHex(AGENT.bytes)])
  assert.equal(remaining, toUnits(350n))
})

test('AgentBudgetBSC — reverts when spending exceeds remaining limit', async () => {
  const { budgetAddr, call, expectRevert } = await setup()

  await call(budgetAddr, AB, 'authorizeAgent', [bytesToHex(AGENT.bytes), toUnits(100n)])

  await expectRevert(
    call(budgetAddr, AB, 'spend', [bytesToHex(PAYEE.bytes), toUnits(101n)], { caller: AGENT }),
    AB,
    'ExceedsRemaining'
  )
})

test('AgentBudgetBSC — reverts when unauthorized caller spends', async () => {
  const { budgetAddr, call, expectRevert } = await setup()

  await expectRevert(
    call(budgetAddr, AB, 'spend', [bytesToHex(PAYEE.bytes), toUnits(50n)], { caller: STRANGER }),
    AB,
    'AgentInactive'
  )
})

test('AgentBudgetBSC — window expiry resets budget automatically', async () => {
  const { budgetAddr, call, read } = await setup()

  await call(budgetAddr, AB, 'authorizeAgent', [bytesToHex(AGENT.bytes), toUnits(200n)])
  await call(budgetAddr, AB, 'spend', [bytesToHex(PAYEE.bytes), toUnits(200n)], { caller: AGENT })

  const [exhausted] = await read(budgetAddr, AB, 'getRemainingBudget', [bytesToHex(AGENT.bytes)])
  assert.equal(exhausted, 0n)

  // Advance time by 86,401 seconds
  const nextWindow = now + 86_401n
  const [refreshed] = await read(budgetAddr, AB, 'getRemainingBudget', [bytesToHex(AGENT.bytes)], { time: nextWindow })
  assert.equal(refreshed, toUnits(200n))

  const r = await call(budgetAddr, AB, 'spend', [bytesToHex(PAYEE.bytes), toUnits(100n)], { caller: AGENT, time: nextWindow })
  assert.equal(r.execResult.exceptionError, undefined)
})

test('AgentBudgetBSC — owner revocation stops all future spends', async () => {
  const { budgetAddr, call, expectRevert } = await setup()

  await call(budgetAddr, AB, 'authorizeAgent', [bytesToHex(AGENT.bytes), toUnits(500n)])
  await call(budgetAddr, AB, 'revokeAgent', [bytesToHex(AGENT.bytes)])

  await expectRevert(
    call(budgetAddr, AB, 'spend', [bytesToHex(PAYEE.bytes), toUnits(50n)], { caller: AGENT }),
    AB,
    'AgentInactive'
  )
})

test('AgentBudgetBSC — non-owner cannot authorize or configure', async () => {
  const { budgetAddr, call, expectRevert } = await setup()

  await expectRevert(
    call(budgetAddr, AB, 'authorizeAgent', [bytesToHex(AGENT.bytes), toUnits(500n)], { caller: STRANGER }),
    AB,
    'NotOwner'
  )
})
