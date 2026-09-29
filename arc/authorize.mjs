// Authorize an agent on a deployed AgentBudget. Post-deploy companion to deploy.mjs.
//
//   node authorize.mjs <contractAddress> <agentAddress> <limitUSDC>
//   PRIVATE_KEY=0x... node authorize.mjs 0x... 0x... 100
//
// Owner-gated (deployer key). limitUSDC is in whole USDC (6dp frozen inside).

import { createWalletClient, createPublicClient, http, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'node:fs'

const RPC = 'https://rpc.mainnet.arc.io'
const CHAIN_ID = 5042

const [, , contract, agent, limitWhole] = process.argv
if (!contract || !agent || !limitWhole) {
  console.error('usage: node authorize.mjs <contractAddress> <agentAddress> <limitUSDC>')
  process.exit(1)
}
const limitUnits = BigInt(Math.round(Number(limitWhole) * 1_000_000))

const arc = defineChain({
  id: CHAIN_ID,
  name: 'Arc Mainnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: [RPC] } },
  contracts: {},
})

const art = JSON.parse(readFileSync(new URL('./artifacts/AgentBudget.json', import.meta.url), 'utf8'))

const key = process.env.PRIVATE_KEY
if (!key) {
  console.error('PRIVATE_KEY not set (the owner/deployer key).')
  process.exit(1)
}
const account = privateKeyToAccount(key.startsWith('0x') ? key : `0x${key}`)
const wallet = createWalletClient({ account, chain: arc, transport: http(RPC) })
const publicClient = createPublicClient({ chain: arc, transport: http(RPC) })

const onChainId = await publicClient.getChainId()
if (onChainId !== CHAIN_ID) throw new Error(`RPC chain id ${onChainId} != ${CHAIN_ID}`)

const hash = await wallet.writeContract({
  address: contract,
  abi: art.abi,
  functionName: 'authorize',
  args: [agent, limitUnits],
  gas: 2_000_000n,
})
const receipt = await publicClient.waitForTransactionReceipt({ hash })
if (receipt.status !== 'success') throw new Error('authorize tx reverted')
console.log(`authorized agent ${agent} with ${limitWhole} USDC / window on ${contract}`)
console.log(`tx ${hash}`)