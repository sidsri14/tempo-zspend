import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWalletClient, createPublicClient, http, defineChain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const here = dirname(fileURLToPath(import.meta.url))

// BSC Mainnet & Testnet definitions
export const bscMainnet = defineChain({
  id: 56,
  name: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://bsc-dataseed.binance.org/'] },
  },
  blockExplorers: {
    default: { name: 'BscScan', url: 'https://bscscan.com' },
  },
})

export const bscTestnet = defineChain({
  id: 97,
  name: 'BNB Smart Chain Testnet',
  nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://data-seed-prebsc-1-s1.binance.org:8545/'] },
  },
  blockExplorers: {
    default: { name: 'BscScan Testnet', url: 'https://testnet.bscscan.com' },
  },
})

// BSC Quote Assets
const BSC_MAINNET_USDT = '0x55d398326f99059fF775485246999027B3197955'
const BSC_TESTNET_MOCK = '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd' // Standard BSC testnet USDT faucet

const artifactPath = resolve(here, 'artifacts/AgentBudgetBSC.json')
if (!existsSync(artifactPath)) {
  console.error('Artifact not found. Please run: node compile.mjs')
  process.exit(1)
}

const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'))

async function main() {
  const isTestnet = process.env.NETWORK === 'testnet'
  const targetChain = isTestnet ? bscTestnet : bscMainnet
  const quoteToken = isTestnet ? BSC_TESTNET_MOCK : (process.env.QUOTE_TOKEN || BSC_MAINNET_USDT)
  const windowSeconds = BigInt(process.env.WINDOW_SECONDS || '86400') // 24 hours

  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) {
    console.log('=== Preflight Check (Read-Only) ===')
    console.log(`Target Network: ${targetChain.name} (Chain ID: ${targetChain.id})`)
    console.log(`Quote Asset: ${quoteToken}`)
    console.log(`Budget Window: ${windowSeconds}s (24h)`)
    console.log('Contract Bytecode Size:', (artifact.bytecode.length - 2) / 2, 'bytes')
    console.log('To execute deployment: $env:PRIVATE_KEY="0x..."; node deploy_bsc.mjs')
    return
  }

  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`)
  console.log(`Deploying from: ${account.address}`)

  const publicClient = createPublicClient({
    chain: targetChain,
    transport: http(),
  })

  const walletClient = createWalletClient({
    account,
    chain: targetChain,
    transport: http(),
  })

  const balance = await publicClient.getBalance({ address: account.address })
  console.log(`Deployer BNB Balance: ${Number(balance) / 1e18} BNB`)

  if (balance === 0n) {
    console.error('Insufficient BNB balance for deployment gas.')
    process.exit(1)
  }

  console.log('Broadcasting deployment transaction...')
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [quoteToken, windowSeconds],
  })

  console.log(`Deployment Tx Sent: ${hash}`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log(`\n🎉 AgentBudgetBSC Deployed Successfully!`)
  console.log(`Contract Address: ${receipt.contractAddress}`)
  console.log(`Block Number: ${receipt.blockNumber}`)
  console.log(`Gas Used: ${receipt.gasUsed}`)
  console.log(`Explorer: ${targetChain.blockExplorers.default.url}/address/${receipt.contractAddress}`)
}

main().catch(console.error)
