import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createVM } from '@ethereumjs/vm'
import { createAddressFromString, createZeroAddress, hexToBytes, bytesToHex } from '@ethereumjs/util'
import { encodeFunctionData, encodeDeployData, decodeFunctionResult, decodeErrorResult, stringToHex, pad } from 'viem'

const load = (n) => JSON.parse(readFileSync(new URL(`../artifacts/${n}.json`, import.meta.url), 'utf8'))
const AB = load('CeloAgentBudget')
const TOKEN = load('MockERC20')

const UNIT = 10n ** 18n
const toUnits = (n) => n * UNIT

const OWNER = createAddressFromString('0x1000000000000000000000000000000000000001')
const AGENT = createAddressFromString('0x2000000000000000000000000000000000000002')
const SERVICE = createAddressFromString('0x3000000000000000000000000000000000000003')
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

const reqId = pad(stringToHex('req-402-001'), { size: 32 })

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

  const tokenAddr = await deploy(TOKEN, ['Celo Dollar', 'cUSD', 18])
  const budgetAddr = await deploy(AB, [bytesToHex(tokenAddr.bytes), window])

  await call(tokenAddr, TOKEN, 'mint', [bytesToHex(budgetAddr.bytes), toUnits(10_000n)])

  return { vm, tokenAddr, budgetAddr, deploy, call, read, expectRevert }
}

test('CeloAgentBudget — authorization and remaining budget view', async () => {
  const { budgetAddr, call, read } = await setup()

  await call(budgetAddr, AB, 'authorizeAgent', [bytesToHex(AGENT.bytes), toUnits(500n)])
  const [remaining, expiresAt] = await read(budgetAddr, AB, 'getRemainingBudget', [bytesToHex(AGENT.bytes)])

  assert.equal(remaining, toUnits(500n))
  assert.equal(expiresAt, now + 86_400n)
})

test('CeloAgentBudget — payService moves cUSD and decrements budget', async () => {
  const { budgetAddr, tokenAddr, call, read } = await setup()

  await call(budgetAddr, AB, 'authorizeAgent', [bytesToHex(AGENT.bytes), toUnits(500n)])

  const r = await call(
    budgetAddr,
    AB,
    'payService',
    [bytesToHex(SERVICE.bytes), toUnits(75n), 'llm-inference-groq', reqId],
    { caller: AGENT },
  )
  assert.equal(r.execResult.exceptionError, undefined)

  const serviceBal = await read(tokenAddr, TOKEN, 'balanceOf', [bytesToHex(SERVICE.bytes)])
  assert.equal(serviceBal, toUnits(75n))

  const [remaining] = await read(budgetAddr, AB, 'getRemainingBudget', [bytesToHex(AGENT.bytes)])
  assert.equal(remaining, toUnits(425n))
})

test('CeloAgentBudget — reverts when service fee exceeds remaining limit', async () => {
  const { budgetAddr, call, expectRevert } = await setup()

  await call(budgetAddr, AB, 'authorizeAgent', [bytesToHex(AGENT.bytes), toUnits(50n)])

  await expectRevert(
    call(
      budgetAddr,
      AB,
      'payService',
      [bytesToHex(SERVICE.bytes), toUnits(51n), 'pyth-bench-fee', reqId],
      { caller: AGENT },
    ),
    AB,
    'ExceedsRemaining',
  )
})

test('CeloAgentBudget — reverts when unauthorized agent attempts service payment', async () => {
  const { budgetAddr, call, expectRevert } = await setup()

  await expectRevert(
    call(
      budgetAddr,
      AB,
      'payService',
      [bytesToHex(SERVICE.bytes), toUnits(10n), 'weather-api', reqId],
      { caller: STRANGER },
    ),
    AB,
    'AgentInactive',
  )
})

test('CeloAgentBudget — window expiry resets service payment quota', async () => {
  const { budgetAddr, call, read } = await setup()

  await call(budgetAddr, AB, 'authorizeAgent', [bytesToHex(AGENT.bytes), toUnits(100n)])
  await call(
    budgetAddr,
    AB,
    'payService',
    [bytesToHex(SERVICE.bytes), toUnits(100n), 'compute-service', reqId],
    { caller: AGENT },
  )

  const [exhausted] = await read(budgetAddr, AB, 'getRemainingBudget', [bytesToHex(AGENT.bytes)])
  assert.equal(exhausted, 0n)

  const nextWindow = now + 86_401n
  const [refreshed] = await read(budgetAddr, AB, 'getRemainingBudget', [bytesToHex(AGENT.bytes)], { time: nextWindow })
  assert.equal(refreshed, toUnits(100n))

  const r = await call(
    budgetAddr,
    AB,
    'payService',
    [bytesToHex(SERVICE.bytes), toUnits(40n), 'compute-service-2', reqId],
    { caller: AGENT, time: nextWindow },
  )
  assert.equal(r.execResult.exceptionError, undefined)
})

test('CeloAgentBudget — owner revocation stops all future service payments', async () => {
  const { budgetAddr, call, expectRevert } = await setup()

  await call(budgetAddr, AB, 'authorizeAgent', [bytesToHex(AGENT.bytes), toUnits(300n)])
  await call(budgetAddr, AB, 'revokeAgent', [bytesToHex(AGENT.bytes)])

  await expectRevert(
    call(
      budgetAddr,
      AB,
      'payService',
      [bytesToHex(SERVICE.bytes), toUnits(20n), 'blocked-service', reqId],
      { caller: AGENT },
    ),
    AB,
    'AgentInactive',
  )
})

test('CeloAgentBudget — non-owner cannot authorize or update limits', async () => {
  const { budgetAddr, call, expectRevert } = await setup()

  await expectRevert(
    call(budgetAddr, AB, 'authorizeAgent', [bytesToHex(AGENT.bytes), toUnits(500n)], { caller: STRANGER }),
    AB,
    'NotOwner',
  )

  await expectRevert(
    call(budgetAddr, AB, 'updateLimit', [bytesToHex(AGENT.bytes), toUnits(1000n)], { caller: STRANGER }),
    AB,
    'NotOwner',
  )
})
