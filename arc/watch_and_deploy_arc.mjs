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
const deploymentConfirmed = process.env.CONFIRM_ARC_MAINNET_DEPLOY === 'YES'
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
    console.log(`  Native balance: ${formatUnits(native, 18)} USDC | ERC-20 USDC balance: ${formatUnits(usdcBal, 6)} USDC`)

    if (native === 0n) {
      console.log('Balance is 0 USDC. Waiting for bridge deposit...')
      return false
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
    console.log(`  Estimated gas: ${estimatedGas} (limit with 20% buffer: ${gas})`)
    console.log(`  Estimated maximum fee: ${formatUnits(estimatedFee, 18)} USDC`)

    if (native < estimatedFee) {
      console.log('Native USDC is below the buffered deployment estimate. Waiting for more funds...')
      return false
    }
    if (!deploymentConfirmed) {
      console.log('Readiness check passed, but no transaction was sent.')
      console.log('After explicit approval, rerun with CONFIRM_ARC_MAINNET_DEPLOY=YES.')
      return false
    }

    console.log('Funds detected and deployment explicitly confirmed. Deploying AgentBudget to Arc Mainnet...')
    const hash = await wallet.deployContract({
      abi: art.abi,
      bytecode: art.bytecode,
      args: [USDC, WINDOW],
      gas,
    })
    console.log(`Deploy tx submitted: ${hash}`)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error('Deployment transaction reverted')
    }
    const deployedAddress = receipt.contractAddress
    console.log(`AgentBudget deployed at: ${deployedAddress}`)
    console.log(`Explorer link: https://explorer.arc.io/address/${deployedAddress}`)

    // Update arc-microgrants-submission.md
    const subPath = 'D:/web3/arc-microgrants-submission.md'
    let subText = readFileSync(subPath, 'utf8')
    subText = subText.replace('<CONTRACT_ADDRESS>', deployedAddress)
    writeFileSync(subPath, subText, 'utf8')
    console.log(`Updated ${subPath} with live contract address.`)
    return true
  } catch (err) {
    console.error('Error during check/deploy:', err.message)
    return false
  }
}

checkAndDeploy()
