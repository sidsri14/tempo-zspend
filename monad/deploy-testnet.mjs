// Deploy MonadSpendGuard to Monad testnet.
// Requires a throwaway testnet wallet funded with MON from https://faucet.monad.xyz.
// MONAD_TESTNET_PRIVATE_KEY=0x... node deploy-testnet.mjs

import { createPublicClient, createWalletClient, defineChain, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'node:fs'

const RPC = 'https://testnet-rpc.monad.xyz'
const CHAIN_ID = 10143
const monadTestnet = defineChain({
  id: CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
})
const artifact = JSON.parse(readFileSync(new URL('./artifacts/MonadSpendGuard.json', import.meta.url), 'utf8'))
const key = process.env.MONAD_TESTNET_PRIVATE_KEY

if (!key) {
  console.error('Set MONAD_TESTNET_PRIVATE_KEY for a throwaway funded testnet wallet.')
  console.error('Faucet: https://faucet.monad.xyz')
  process.exit(1)
}

const account = privateKeyToAccount(key.startsWith('0x') ? key : `0x${key}`)
const client = createPublicClient({ chain: monadTestnet, transport: http(RPC) })
const wallet = createWalletClient({ account, chain: monadTestnet, transport: http(RPC) })
if (await client.getChainId() !== CHAIN_ID) throw new Error('Unexpected RPC chain ID')

const balance = await client.getBalance({ address: account.address })
if (balance === 0n) {
  console.error(`No testnet MON at ${account.address}. Fund it via https://faucet.monad.xyz and retry.`)
  process.exit(2)
}

const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode, args: [86_400n] })
console.log(`Deployment transaction: ${hash}`)
const receipt = await client.waitForTransactionReceipt({ hash })
if (receipt.status !== 'success') throw new Error('Deployment reverted')
console.log(`MonadSpendGuard: ${receipt.contractAddress}`)
console.log(`Explorer: https://testnet.monadvision.com/address/${receipt.contractAddress}`)
