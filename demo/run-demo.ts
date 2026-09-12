import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generatePrivateKey } from 'viem/accounts'
import type { Address } from 'viem'
import { Abis } from 'viem/tempo'
import { makeReadOnlyClient, makeWalletClient, makeRootAccount, PATHUSD } from '../src/chain.js'
import { authorizeAgentKey, remainingLimit } from '../src/keychain.js'
import { DEFAULT_POLICY, usd, type SpendRequest } from '../src/policy.js'
import { balanceOf, executeApproved, fundAndPrepare, makePayment, printReport, propose } from '../src/treasury.js'
import { todaySnapshot, reset } from '../src/ledger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const WALLET = join(__dirname, '..', '.zspend', 'wallet.json')

function loadOrCreate(): `0x${string}` {
  if (existsSync(WALLET)) {
    const meta = JSON.parse(readFileSync(WALLET, 'utf8'))
    if (meta.privateKey) return meta.privateKey as `0x${string}`
  }
  const pk = generatePrivateKey()
  mkdirSync(dirname(WALLET), { recursive: true })
  writeFileSync(WALLET, JSON.stringify({ privateKey: pk, created: new Date().toISOString() }, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  })
  return pk
}

const T = (m: string) => console.log(`\n[x] ${m}`)

const RECIPIENT_INFRA = '0x401a9eC6770c18AF00Fed66F8f881b4809a60472' as Address
const RECIPIENT_ADS = '0xdD949650b44DF852080b5e2c93b722Fe381bAc1f' as Address
const RECIPIENT_ROGUE = '0x7F44670eDa2CEB89bf41532f313359AC982425a6' as Address

function show(verdict: { decision: string; reason: string }, request: SpendRequest) {
  console.log(`  ${request.id.padEnd(7)} ${request.category.padEnd(11)} ${usd(request.amountUnits).padStart(10)} -> ${request.recipient}  [${verdict.decision}]`)
  console.log(`        ${verdict.reason}`)
}

async function main() {
  const rootPriv = loadOrCreate()
  const root = makeRootAccount(rootPriv)
  const rootClient = makeWalletClient(root)
  const ro = makeReadOnlyClient()
  const rootAddr = root.address as Address
  const policy = DEFAULT_POLICY

console.log('TEMPO Z-SPEND — on-chain-enforced agentic treasury')
  console.log(`network:  Moderato testnet (chain ${ro.chain?.id ?? 42431})`)
  console.log(`root:     ${rootAddr}`)

  reset()
  console.log('(ledger window reset for this run)')

  T('1. fund + prepare (faucet, pathUSD fee token)')
  try {
    await fundAndPrepare(rootClient)
  } catch (e) {
    const msg = String((e as Error).message ?? e)
    if (!/already/.test(msg)) throw e
  }
  console.log(`  root balance ${usd(await balanceOf(ro, rootAddr))}`)

T('2. authorize AGENT key — on-chain $100/day pathUSD limit, scoped to pathUSD.transfer')
  const agent = await authorizeAgentKey(rootClient, root, {
    name: 'agent-ops',
    limitUnits: 100n * 10n ** 6n,
    periodSeconds: 86_400,
  })
  console.log(`  key:      ${agent.keyId}`)
  console.log(`  auth tx:  ${agent.txHash}`)

  T('3. preload agent vault (root -> agent, $200)')
  const preloadHash = await rootClient.writeContract({
    address: PATHUSD,
    abi: Abis.tip20,
    functionName: 'transfer',
    args: [agent.keyId, 200n * 10n ** 6n],
  })
  await ro.waitForTransactionReceipt({ hash: preloadHash, timeout: 30_000 })
  console.log(`  agent balance ${usd(await balanceOf(ro, agent.keyId))}`)

  const agentClient = makeWalletClient(agent.accessKey)

  T('4. propose + execute payments through the policy')
  const pay1 = makePayment('pay-001', 'ops', RECIPIENT_INFRA, '80.00', 'infra invoice')
  const v1 = propose(policy, pay1)
  show(v1, pay1)
  if (v1.decision === 'APPROVE') {
    const res = await executeApproved(agentClient, policy, pay1, await balanceOf(ro, agent.keyId))
    if (res.txHash) {
      await ro.waitForTransactionReceipt({ hash: res.txHash, timeout: 30_000 })
      console.log(`  -> tx ${res.txHash}`)
    }
  }

  T('5. propose a payment that exceeds the category cap (REJECT, fail-closed)')
  const pay2 = makePayment('pay-002', 'marketing', RECIPIENT_ADS, '160.00', 'ads')
  const v2 = propose(policy, pay2)
  show(v2, pay2)

T('6. on-chain limit verification')
  const lim = await remainingLimit(ro, agent)
  console.log(`  agent remaining allowance: ${usd(lim.remaining)} / \$100 (period resets ${new Date(Number(lim.periodEnd) * 1000).toISOString()})`)

  T('7. policy OK but key limit exhausted — must be blocked on-chain')
  const pay3 = makePayment('pay-003', 'ops', RECIPIENT_ROGUE, '100.00', 'rogue invoice')
  const v3 = propose(policy, pay3)
  show(v3, pay3)
  if (v3.decision === 'APPROVE') {
    try {
      await executeApproved(agentClient, policy, pay3, await balanceOf(ro, agent.keyId))
      console.log('  !! NOT BLOCKED — bug')
    } catch (e) {
      console.log(`  blocked on-chain: ${String((e as Error & { shortMessage?: string }).shortMessage ?? (e as Error).message ?? '').slice(0, 240)}`)
    }
  }

  T('8. daily report')
  printReport(policy)
  const exec = todaySnapshot().byCategory
  const total = (exec.engineering ?? 0n) + (exec.marketing ?? 0n) + (exec.ops ?? 0n)
  console.log(`  executed on-chain today: ${usd(total)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
