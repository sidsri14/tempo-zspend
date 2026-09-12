import { createClient, http, Account } from 'viem/tempo'
import { tempoTestnet } from 'viem/chains'
import type { Address, Hex } from 'viem'

export const TEMPO_TESTNET = tempoTestnet

export const PATHUSD = '0x20c0000000000000000000000000000000000000' as Address

export const FEE_TOKEN = PATHUSD

export const DECIMALS = 6n

/** Convert a decimal USD string into 6-decimals units. */
export function toUnits(value: string): bigint {
  const [whole, frac = ''] = value.split('.')
  const padded = (frac + '000000').slice(0, Number(DECIMALS))
  const fracUnits = BigInt(padded || '0')
  return BigInt(whole || '0') * 10n ** DECIMALS + fracUnits
}

/** Convert 6-decimals units back into a decimal USD string. */
export function fromUnits(units: bigint): string {
  const neg = units < 0n
  const abs = neg ? -units : units
  const s = abs.toString().padStart(7, '0')
  const whole = s.slice(0, -6) || '0'
  const frac = s.slice(-6)
  return `${neg ? '-' : ''}${whole}.${frac}`
}

/** Root treasury wallet (secp256k1). */
export function makeRootAccount(privateKey: Hex) {
  return Account.fromSecp256k1(privateKey)
}

/** Access key wallet bound to a root account. */
export function makeAccessAccount(privateKey: Hex, access: ReturnType<typeof makeRootAccount>) {
  return Account.fromSecp256k1(privateKey, { access })
}

export type TempoRoot = ReturnType<typeof makeRootAccount>

export type TempoAccess = ReturnType<typeof makeAccessAccount>

export type AnyAccount = Awaited<ReturnType<typeof Account.fromSecp256k1>>

export type TempoWalletClient = ReturnType<typeof makeWalletClient>

export type TempoPublicClient = ReturnType<typeof makeReadOnlyClient>

export function makeWalletClient(account: AnyAccount) {
  return createClient({
    account: account as never,
    chain: TEMPO_TESTNET.extend({ feeToken: FEE_TOKEN }),
    transport: http(TEMPO_TESTNET.rpcUrls.default.http[0], { timeout: 120_000 }),
  })
}

export function makeReadOnlyClient() {
  return createClient({
    chain: TEMPO_TESTNET,
    transport: http(TEMPO_TESTNET.rpcUrls.default.http[0], { timeout: 120_000 }),
  })
}