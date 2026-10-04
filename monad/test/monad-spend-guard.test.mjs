import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createVM } from '@ethereumjs/vm'
import { createAccount, createAddressFromString, createZeroAddress, hexToBytes, bytesToHex } from '@ethereumjs/util'
import { encodeFunctionData, encodeDeployData, decodeFunctionResult, decodeErrorResult } from 'viem'

const guard = JSON.parse(readFileSync(new URL('../artifacts/MonadSpendGuard.json', import.meta.url), 'utf8'))
const OWNER = createAddressFromString('0x1000000000000000000000000000000000000001')
const AGENT = createAddressFromString('0x2000000000000000000000000000000000000002')
const PAYEE = createAddressFromString('0x3000000000000000000000000000000000000003')
const REJECTING_PAYEE = createAddressFromString('0x3000000000000000000000000000000000000004')
const STRANGER = createAddressFromString('0x4000000000000000000000000000000000000004')
const now = 1_790_000_000n
const oneMon = 10n ** 18n

const blockAt = (timestamp) => ({
  header: { number: 1n, coinbase: createZeroAddress(), timestamp, difficulty: 0n, prevRandao: new Uint8Array(32), gasLimit: 30_000_000n, baseFeePerGas: 0n },
})

async function setup({ window = 86_400n, escrow = 10n * oneMon, timestamp = now } = {}) {
  const vm = await createVM()
  await vm.stateManager.putAccount(OWNER, createAccount({ balance: escrow * 2n }))
  const deployed = await vm.evm.runCall({
    caller: OWNER,
    data: hexToBytes(encodeDeployData({ abi: guard.abi, bytecode: guard.bytecode, args: [window] })),
    gasLimit: 10_000_000n,
    block: blockAt(timestamp),
  })
  assert.equal(deployed.execResult.exceptionError, undefined)
  const address = deployed.createdAddress

  const call = (functionName, args = [], { caller = OWNER, value = 0n, time = timestamp } = {}) =>
    vm.evm.runCall({
      caller,
      to: address,
      data: hexToBytes(encodeFunctionData({ abi: guard.abi, functionName, args })),
      value,
      gasLimit: 5_000_000n,
      block: blockAt(time),
    })
  const read = async (functionName, args = [], options = {}) => {
    const result = await call(functionName, args, options)
    assert.equal(result.execResult.exceptionError, undefined)
    return decodeFunctionResult({ abi: guard.abi, functionName, data: bytesToHex(result.execResult.returnValue) })
  }
  const expectRevert = async (promise, errorName) => {
    const result = await promise
    assert.ok(result.execResult.exceptionError, 'expected a revert')
    const decoded = decodeErrorResult({ abi: guard.abi, data: bytesToHex(result.execResult.returnValue) })
    assert.equal(decoded.errorName, errorName)
  }

  const deposit = await vm.evm.runCall({ caller: OWNER, to: address, value: escrow, gasLimit: 5_000_000n, block: blockAt(timestamp) })
  assert.equal(deposit.execResult.exceptionError, undefined)
  return { vm, address, call, read, expectRevert }
}

test('authorizes an agent and exposes the full initial budget', async () => {
  const { call, read } = await setup()
  await call('authorizeAgent', [bytesToHex(AGENT.bytes), 2n * oneMon])
  const [remaining, expiresAt] = await read('getRemainingBudget', [bytesToHex(AGENT.bytes)])
  assert.equal(remaining, 2n * oneMon)
  assert.equal(expiresAt, now + 86_400n)
})

test('spends native MON from escrow and decrements only the caller budget', async () => {
  const { vm, call, read } = await setup()
  await call('authorizeAgent', [bytesToHex(AGENT.bytes), 2n * oneMon])
  const spend = await call('spend', [bytesToHex(PAYEE.bytes), 750_000_000_000_000_000n], { caller: AGENT })
  assert.equal(spend.execResult.exceptionError, undefined)
  assert.equal((await vm.stateManager.getAccount(PAYEE)).balance, 750_000_000_000_000_000n)
  const [remaining] = await read('getRemainingBudget', [bytesToHex(AGENT.bytes)])
  assert.equal(remaining, 1_250_000_000_000_000_000n)
})

test('fails closed when the requested spend exceeds the rolling budget', async () => {
  const { call, expectRevert } = await setup()
  await call('authorizeAgent', [bytesToHex(AGENT.bytes), oneMon])
  await expectRevert(call('spend', [bytesToHex(PAYEE.bytes), oneMon + 1n], { caller: AGENT }), 'ExceedsRemaining')
})

test('does not consume allowance when the recipient rejects a MON transfer', async () => {
  const { vm, call, read, expectRevert } = await setup()
  await call('authorizeAgent', [bytesToHex(AGENT.bytes), oneMon])
  await vm.stateManager.putCode(REJECTING_PAYEE, hexToBytes('0x60006000fd'))

  await expectRevert(
    call('spend', [bytesToHex(REJECTING_PAYEE.bytes), oneMon], { caller: AGENT }),
    'TransferFailed',
  )

  const [remaining] = await read('getRemainingBudget', [bytesToHex(AGENT.bytes)])
  assert.equal(remaining, oneMon)
})

test('fails closed for inactive agents and after revocation', async () => {
  const { call, expectRevert } = await setup()
  await expectRevert(call('spend', [bytesToHex(PAYEE.bytes), oneMon], { caller: STRANGER }), 'AgentInactive')
  await call('authorizeAgent', [bytesToHex(AGENT.bytes), oneMon])
  await call('revokeAgent', [bytesToHex(AGENT.bytes)])
  await expectRevert(call('spend', [bytesToHex(PAYEE.bytes), oneMon], { caller: AGENT }), 'AgentInactive')
})

test('resets the rolling budget after the configured window', async () => {
  const { call, read } = await setup()
  await call('authorizeAgent', [bytesToHex(AGENT.bytes), oneMon])
  await call('spend', [bytesToHex(PAYEE.bytes), oneMon], { caller: AGENT })
  const [exhausted] = await read('getRemainingBudget', [bytesToHex(AGENT.bytes)])
  assert.equal(exhausted, 0n)
  const [reset] = await read('getRemainingBudget', [bytesToHex(AGENT.bytes)], { time: now + 86_401n })
  assert.equal(reset, oneMon)
})

test('owner cannot withdraw more than the escrowed balance', async () => {
  const { call, expectRevert } = await setup({ escrow: oneMon })
  await expectRevert(call('withdraw', [bytesToHex(OWNER.bytes), oneMon + 1n]), 'InsufficientEscrow')
})
