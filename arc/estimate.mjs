// Read-only Arc mainnet deployment estimate. This script never loads a key and
// never broadcasts a transaction.
//
//   npm run estimate -- 0xDeployerAddress

import {
  createPublicClient,
  defineChain,
  encodeDeployData,
  formatUnits,
  getAddress,
  http,
} from 'viem'
import { readFileSync } from 'node:fs'

const RPC = 'https://rpc.mainnet.arc.io'
const CHAIN_ID = 5042
const USDC = '0x3600000000000000000000000000000000000000'
const WINDOW = 86_400n

const addressArg = process.argv[2]
if (!addressArg) {
  console.error('usage: npm run estimate -- <deployerAddress>')
  process.exit(1)
}
const deployer = getAddress(addressArg)

const arc = defineChain({
  id: CHAIN_ID,
  name: 'Arc Mainnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  contracts: {},
})

const art = JSON.parse(
  readFileSync(new URL('./artifacts/AgentBudget.json', import.meta.url), 'utf8'),
)
const publicClient = createPublicClient({ chain: arc, transport: http(RPC) })

const deploymentData = encodeDeployData({
  abi: art.abi,
  bytecode: art.bytecode,
  args: [USDC, WINDOW],
})

const [onChainId, native, erc20View, estimatedGas, gasPrice, blockNumber] =
  await Promise.all([
    publicClient.getChainId(),
    publicClient.getBalance({ address: deployer }),
    publicClient.readContract({
      address: USDC,
      abi: [
        {
          type: 'function',
          name: 'balanceOf',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ type: 'uint256' }],
        },
      ],
      functionName: 'balanceOf',
      args: [deployer],
    }),
    publicClient.estimateGas({ account: deployer, data: deploymentData }),
    publicClient.getGasPrice(),
    publicClient.getBlockNumber(),
  ])

if (onChainId !== CHAIN_ID) {
  throw new Error(`RPC chain id ${onChainId} != ${CHAIN_ID}`)
}

const gasLimit = (estimatedGas * 120n + 99n) / 100n
const maximumFee = gasLimit * gasPrice

console.log(`Arc mainnet block ${blockNumber}`)
console.log(`deployer ${deployer}`)
console.log(`  native balance ${formatUnits(native, 18)} USDC`)
console.log(
  `  ERC-20 balance view ${formatUnits(erc20View, 6)} USDC (same underlying balance)`,
)
console.log(`  estimated gas ${estimatedGas}`)
console.log(`  gas limit with 20% buffer ${gasLimit}`)
console.log(`  gas price ${formatUnits(gasPrice, 9)} Gwei`)
console.log(`  estimated maximum fee ${formatUnits(maximumFee, 18)} USDC`)
console.log(
  native >= maximumFee
    ? '  readiness: sufficient balance; no transaction sent'
    : `  readiness: fund at least ${formatUnits(maximumFee - native, 18)} more USDC; no transaction sent`,
)
