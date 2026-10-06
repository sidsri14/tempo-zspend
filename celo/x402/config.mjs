import { getAddress } from 'viem'

const NETWORKS = {
  testnet: {
    id: 'eip155:11142220',
    facilitatorUrl: 'https://api.x402.sepolia.celo.org',
    assets: {
      USDC: {
        address: '0x01C5C0122039549AD1493B8220cABEdD739BC44E',
        name: 'USDC',
        version: '2',
        decimals: 6,
      },
    },
  },
  mainnet: {
    id: 'eip155:42220',
    facilitatorUrl: 'https://api.x402.celo.org',
    assets: {
      USDC: {
        address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
        name: 'USDC',
        version: '2',
        decimals: 6,
      },
      USDT: {
        address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
        name: 'Tether USD',
        version: '1',
        decimals: 6,
      },
      USAT: {
        address: '0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771',
        name: 'Tether America USD',
        version: '1',
        decimals: 6,
      },
    },
  },
}

function required(value, name) {
  if (!value || !value.trim()) {
    throw new Error(`${name} is required`)
  }
  return value.trim()
}

function positiveAtomicAmount(value) {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error('X402_PRICE_ATOMIC must be a positive integer string')
  }
  return value
}

export function loadX402Config(env = process.env) {
  const mode = env.X402_NETWORK ?? 'testnet'
  const network = NETWORKS[mode]
  if (!network) {
    throw new Error('X402_NETWORK must be testnet or mainnet')
  }

  const assetCode = (env.X402_ASSET ?? (mode === 'mainnet' ? 'USAT' : 'USDC')).toUpperCase()
  const asset = network.assets[assetCode]
  if (!asset) {
    throw new Error(`${assetCode} is not supported on Celo ${mode}`)
  }

  return {
    mode,
    network: network.id,
    facilitatorUrl: network.facilitatorUrl,
    apiKey: required(env.X402_API_KEY, 'X402_API_KEY'),
    sellerPayTo: getAddress(required(env.SELLER_PAY_TO, 'SELLER_PAY_TO')),
    price: {
      amount: positiveAtomicAmount(env.X402_PRICE_ATOMIC ?? '10000'),
      asset: getAddress(asset.address),
      extra: { name: asset.name, version: asset.version },
    },
  }
}

export function buildPolicyRoutes(config) {
  return {
    'POST /v1/policy/quote': {
      accepts: [{
        scheme: 'exact',
        network: config.network,
        payTo: config.sellerPayTo,
        price: config.price,
      }],
      description: 'Agent spend-policy evaluation on Celo',
    },
  }
}
