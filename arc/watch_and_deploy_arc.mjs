import { createWalletClient, createPublicClient, http, defineChain, formatUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync, writeFileSync } from 'node:fs'

const RPC = 'https://rpc.mainnet.arc.io'
const CHAIN_ID = 5042
const USDC = '0x3600000000000000000000000000000000000000'
const WINDOW = 86_400n

const arc = defineChain({
  id: CHAIN_ID,
  name: 'Arc Mainnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  contracts: {},
})

const envContent = readFileSync(new URL('./.env.deploy', import.meta.url), 'utf8')
const keyMatch = envContent.match(/PRIVATE_KEY=(0x[a-fA-F0-9]{64})/)
if (!keyMatch) {
  console.error('Could not find PRIVATE_KEY in .env.deploy')
  process.exit(1)
}
const key = keyMatch[1]
const account = privateKeyToAccount(key)
const wallet = createWalletClient({ account, chain: arc, transport: http(RPC) })
const publicClient = createPublicClient({ chain: arc, transport: http(RPC) })

const art = JSON.parse(readFileSync(new URL('./artifacts/AgentBudget.json', import.meta.url), 'utf8'))

async function checkAndDeploy() {
  try {
    const native = await publicClient.getBalance({ address: account.address })
    const usdcBal = await publicClient.readContract({
      address: USDC,
      abi: [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] }],
      functionName: 'balanceOf',
      args: [account.address],
    })

    console.log(`[${new Date().toISOString()}] Checking wallet ${account.address}...`)
    console.log(`  Native balance: ${formatUnits(native, 18)} USDC | ERC20 USDC balance: ${formatUnits(usdcBal, 18)} USDC`)

    if (usdcBal > 0n || native > 0n) {
      console.log('🎉 Funds detected! Deploying AgentBudget to Arc Mainnet...')
      const hash = await wallet.deployContract({
        abi: art.abi,
        bytecode: art.bytecode,
        args: [USDC, WINDOW],
        gas: 2_000_000n,
      })
      console.log(`Deploy tx submitted: ${hash}`)
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') {
        throw new Error('Deployment transaction reverted')
      }
      const deployedAddress = receipt.contractAddress
      console.log(`✅ AgentBudget deployed at: ${deployedAddress}`)
      console.log(`Explorer link: https://arcexplorer.org/address/${deployedAddress}`)

      // Update arc-microgrants-submission.md
      const subPath = 'D:/web3/arc-microgrants-submission.md'
      let subText = readFileSync(subPath, 'utf8')
      subText = subText.replace('<CONTRACT_ADDRESS>', deployedAddress)
      writeFileSync(subPath, subText, 'utf8')
      console.log(`Updated ${subPath} with live contract address.`)
      return true
    } else {
      console.log('Balance is 0 USDC. Waiting for bridge deposit...')
      return false
    }
  } catch (err) {
    console.error('Error during check/deploy:', err.message)
    return false
  }
}

checkAndDeploy()
