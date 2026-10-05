import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineChain, stringToHex, pad } from 'viem'

const here = dirname(fileURLToPath(import.meta.url))
const AB = JSON.parse(readFileSync(resolve(here, 'artifacts/CeloAgentBudget.json'), 'utf8'))

export const celoMainnet = defineChain({
  id: 42220,
  name: 'Celo Mainnet',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: ['https://forno.celo.org'] } },
})

export const celoAlfajores = defineChain({
  id: 44787,
  name: 'Celo Alfajores Testnet',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: ['https://alfajores-forno.celo-testnet.org'] } },
})

class CeloAgentServiceBuyer {
  constructor(config = {}) {
    this.budgetContractAddress = config.budgetContractAddress || '0x0000000000000000000000000000000000000000'
    this.maxSinglePaymentCUSD = config.maxSinglePaymentCUSD || 10
    this.dryRunOnly = config.dryRunOnly ?? true
  }

  async simulateThirdPartyServiceRequest(serviceId) {
    return {
      status: 402,
      statusText: 'Payment Required',
      headers: {
        'x402-network': 'celo',
        'x402-token': 'cUSD',
        'x402-amount': '0.05',
        'x402-payee': '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        'x402-request-id': 'req_celo_' + Date.now().toString(16),
      },
    }
  }

  async buyService(serviceId, requestPayload) {
    console.log(`[Celo Agent] Requesting third-party service: ${serviceId}...`)
    const initialResponse = await this.simulateThirdPartyServiceRequest(serviceId)

    if (initialResponse.status === 402) {
      const { headers } = initialResponse
      console.log(`[Celo Agent] Received HTTP 402: Service requires ${headers['x402-amount']} ${headers['x402-token']} on Celo`)
      console.log(`[Celo Agent] Payee Address: ${headers['x402-payee']}`)
      console.log(`[Celo Agent] Request ID: ${headers['x402-request-id']}`)

      const amountNum = parseFloat(headers['x402-amount'])
      if (amountNum > this.maxSinglePaymentCUSD) {
        throw new Error(`Policy violation: service fee $${amountNum} exceeds single-payment cap $${this.maxSinglePaymentCUSD}`)
      }

      const reqIdBytes32 = pad(stringToHex(headers['x402-request-id'].slice(0, 31)), { size: 32 })

      if (this.dryRunOnly) {
        const simulatedTxHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
        console.log(`[Celo Agent] Local policy simulation: CeloAgentBudget.payService() would approve this payment`)
        console.log(`[Celo Agent] Simulated settlement txHash: ${simulatedTxHash}`)
        console.log(`[Celo Agent] Resubmitting service request with header: 'Authorization: x402-celo ${simulatedTxHash}'`)

        return {
          status: 200,
          serviceId,
          settledVia: 'Local simulation of Celo cUSD settlement',
          cost: headers['x402-amount'] + ' ' + headers['x402-token'],
          txHash: simulatedTxHash,
          output: {
            success: true,
            data: `Simulated service result for payload [${JSON.stringify(requestPayload)}].`,
          },
        }
      }
    }

    throw new Error('Unexpected service response')
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('=== Z-Spend Celo: Autonomous Agent Service Buyer (Agents on Open Rails) ===\n')
  const buyer = new CeloAgentServiceBuyer({ dryRunOnly: true })
  buyer
    .buyService('groq-llama3-inference', { prompt: 'Analyze real-time Celo FX liquidity' })
    .then((res) => {
      console.log('\n[Celo Agent] Service execution completed successfully:')
      console.log(JSON.stringify(res, null, 2))
    })
    .catch(console.error)
}

export { CeloAgentServiceBuyer }
