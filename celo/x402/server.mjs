import { serve } from '@hono/node-server'
import { HTTPFacilitatorClient } from '@x402/core/server'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import { paymentMiddleware, x402ResourceServer } from '@x402/hono'
import { Hono } from 'hono'

import { buildPolicyRoutes, loadX402Config } from './config.mjs'

export function createApp(env = process.env) {
  const config = loadX402Config(env)
  const facilitator = new HTTPFacilitatorClient({
    url: config.facilitatorUrl,
    createAuthHeaders: async () => {
      const headers = { 'X-API-Key': config.apiKey }
      return { verify: headers, settle: headers, supported: headers }
    },
  })
  const resourceServer = new x402ResourceServer(facilitator)
  resourceServer.register('eip155:*', new ExactEvmScheme())

  const app = new Hono()
  app.get('/health', (context) => context.json({
    status: 'ok',
    network: config.network,
    asset: config.price.extra.name,
  }))
  app.use(paymentMiddleware(buildPolicyRoutes(config), resourceServer))
  app.post('/v1/policy/quote', async (context) => {
    const request = await context.req.json().catch(() => ({}))
    const amount = typeof request.amount === 'string' ? request.amount : null
    const decision = amount && /^\d+(\.\d+)?$/.test(amount) ? 'review' : 'reject'

    return context.json({
      decision,
      reason: decision === 'review'
        ? 'Amount is syntactically valid; evaluate the configured on-chain budget before settlement.'
        : 'Provide amount as a decimal string.',
      network: config.network,
    })
  })

  return { app, config }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { app } = createApp()
  const port = Number.parseInt(process.env.PORT ?? '8787', 10)
  serve({ fetch: app.fetch, port })
  console.log(`Celo x402 policy API listening on http://127.0.0.1:${port}`)
}
