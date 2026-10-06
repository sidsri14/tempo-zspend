import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPolicyRoutes, loadX402Config } from '../x402/config.mjs'
import { createApp } from '../x402/server.mjs'

const payTo = '0x1111111111111111111111111111111111111111'
const baseEnv = {
  X402_API_KEY: 'x402_test_not_a_real_key',
  SELLER_PAY_TO: payTo,
}

test('x402 config defaults to Celo Sepolia USDC', () => {
  const config = loadX402Config(baseEnv)
  assert.equal(config.mode, 'testnet')
  assert.equal(config.network, 'eip155:11142220')
  assert.equal(config.price.amount, '10000')
  assert.equal(config.price.extra.name, 'USDC')
  assert.equal(config.facilitatorUrl, 'https://api.x402.sepolia.celo.org')
})

test('x402 config supports the mainnet USAT route with its real EIP-712 domain', () => {
  const config = loadX402Config({
    ...baseEnv,
    X402_NETWORK: 'mainnet',
    X402_ASSET: 'USAT',
    X402_PRICE_ATOMIC: '25000',
  })
  assert.equal(config.network, 'eip155:42220')
  assert.equal(config.price.amount, '25000')
  assert.deepEqual(config.price.extra, { name: 'Tether America USD', version: '1' })
})

test('x402 config rejects unsupported assets, missing configuration, and decimal prices', () => {
  assert.throws(() => loadX402Config({ ...baseEnv, X402_ASSET: 'USAT' }), /not supported/)
  assert.throws(() => loadX402Config({ SELLER_PAY_TO: payTo }), /X402_API_KEY is required/)
  assert.throws(() => loadX402Config({ ...baseEnv, X402_PRICE_ATOMIC: '0.01' }), /positive integer string/)
})

test('policy route mirrors the validated payment requirements', () => {
  const config = loadX402Config({ ...baseEnv, X402_PRICE_ATOMIC: '10000' })
  const route = buildPolicyRoutes(config)['POST /v1/policy/quote']
  assert.equal(route.accepts[0].network, 'eip155:11142220')
  assert.equal(route.accepts[0].payTo, payTo)
  assert.equal(route.accepts[0].price.amount, '10000')
})

test('server exposes health without payment and returns a protocol 402 for the paid route', async () => {
  const { app } = createApp(baseEnv)
  const health = await app.request('http://localhost/health')
  assert.equal(health.status, 200)
  assert.deepEqual(await health.json(), {
    status: 'ok',
    network: 'eip155:11142220',
    asset: 'USDC',
  })

  const protectedResponse = await app.request('http://localhost/v1/policy/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
  assert.equal(protectedResponse.status, 402)
  assert.ok(protectedResponse.headers.get('payment-required'))
})
