// Deploy AgentBudget to Arc mainnet (chain 5042).
//
//   PRIVATE_KEY=0x... node deploy.mjs
//
// Requires USDC on Arc to pay gas (USDC is the gas token, ~0.01 USDC / tx).
// Never commit a key. A throwaway deployer is fine — this contract is owner-gated.

import { createWalletClient, createPublicClient, http, defineChain, formatUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'node:fs'

const RPC = 'https://rpc.mainnet.arc.io'
const CHAIN_ID = 5042
/** Arc native gas uses 18 decimals; the optional ERC-20 interface uses 6. */
const USDC = '0x3600000000000000000000000000000000000000'
const WINDOW = 86_400n // 1 day budget window

const arc = defineChain({
  id: CHAIN_ID,
  name: 'Arc Mainnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  contracts: {},
})

const art = JSON.parse(readFileSync(new URL('./artifacts/AgentBudget.json', import.meta.url), 'utf8'))

const key = process.env.PRIVATE_KEY
const deploymentConfirmed = process.env.CONFIRM_ARC_MAINNET_DEPLOY === 'YES'
if (!key) {
  console.error('PRIVATE_KEY not set. Generate a throwaway key first:')
  console.error(`  node -e "console.log('0x'+require('crypto').randomBytes(32).toString('hex'))"`)
  console.error('then fund it with a small amount of USDC on Arc (chain 5042).')
  process.exit(1)
}

const account = privateKeyToAccount(key.startsWith('0x') ? key : `0x${key}`)
const wallet = createWalletClient({ account, chain: arc, transport: http(RPC) })
const publicClient = createPublicClient({ chain: arc, transport: http(RPC) })

const onChainId = await publicClient.getChainId()
if (onChainId !== CHAIN_ID) throw new Error(`RPC chain id ${onChainId} != ${CHAIN_ID}`)

const native = await publicClient.getBalance({ address: account.address })
const usdcBal = await publicClient.readContract({
  address: USDC,
  abi: [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] }],
  functionName: 'balanceOf',
  args: [account.address],
})
console.log(`deployer ${account.address}`)
console.log(`  native balance ${formatUnits(native, 18)} USDC`)
console.log(`  ERC-20 balance ${formatUnits(usdcBal, 6)} USDC`)
if (native === 0n) {
  console.error('\nNo USDC on Arc — bridge/deposit a small amount first (gas is paid in USDC).')
  process.exit(2)
}

const estimatedGas = await publicClient.estimateContractGas({
  account: account.address,
  abi: art.abi,
  bytecode: art.bytecode,
  args: [USDC, WINDOW],
})
const gas = (estimatedGas * 120n + 99n) / 100n
const gasPrice = await publicClient.getGasPrice()
const estimatedFee = gas * gasPrice
console.log(`  estimated gas ${estimatedGas} (limit with 20% buffer: ${gas})`)
console.log(`  estimated maximum fee ${formatUnits(estimatedFee, 18)} USDC at current gas price`)

if (native < estimatedFee) {
  console.error('\nInsufficient native USDC for the buffered deployment estimate.')
  process.exit(3)
}
if (!deploymentConfirmed) {
  console.error('\nReadiness check passed, but no transaction was sent.')
  console.error('After explicit approval, rerun with CONFIRM_ARC_MAINNET_DEPLOY=YES.')
  process.exit(4)
}

const hash = await wallet.deployContract({
  abi: art.abi,
  bytecode: art.bytecode,
  args: [USDC, WINDOW],
  gas,
})
console.log(`\ndeploy tx ${hash}`)
const receipt = await publicClient.waitForTransactionReceipt({ hash })
if (receipt.status !== 'success') throw new Error('deploy tx reverted')
console.log(`AgentBudget deployed at ${receipt.contractAddress}`)
console.log(`  window ${WINDOW}s · owner ${account.address} · usdc ${USDC}`)
console.log(`  verify: https://explorer.arc.io/address/${receipt.contractAddress}`)
console.log(`\nnext: node authorize.mjs ${receipt.contractAddress} <agentAddress> <limitUSDC>`)
