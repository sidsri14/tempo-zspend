import { Abis, Actions, Addresses, Account } from 'viem/tempo'
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts'
import { keccak256, toBytes } from 'viem'
import type { Address, Hex } from 'viem'
import { PATHUSD, type TempoRoot, type TempoPublicClient, type TempoWalletClient } from './chain.js'

export interface AuthorizedKeySpec {
  name: string
  /** Spending limit (units) over `periodSeconds`. 0/undefined = no on-chain limit. */
  limitUnits?: bigint
  /** Period for the recurring limit (seconds). Default 24h. */
  periodSeconds?: number
  /** Restrict the key to a recipient allowlist on transfer. Empty = any payee. */
  recipientAllowlist?: Address[]
  /** Key expiry (epoch secs). Default 30 days. */
  expiry?: number
}

export interface AuthorizedKey {
  name: string
  keyId: Address
  root: Address
  privateKey: Hex
  accessKey: ReturnType<typeof Account.fromSecp256k1<{ access: TempoRoot }>>
  txHash: Address
}

/** Domain-separated witness label so key authorizations never collide across runs. */
export function witnessFor(label: string): Hex {
  return keccak256(toBytes(`tempo-zspend/access-key/v1/${label}`))
}

/**
 * Authorize an access key on Tempo:
 *  - bound to the root treasury account
 *  - on-chain TIP-20 spending limit (periodic, auto-resets)
 *  - call scope restricted to pathUSD.transfer (optionally per-recipient)
 *  - expiry + witness revocation handle
 *
 * Once authorized, a compromised key cannot spend more than its on-chain
 * limit even if the off-chain policy is fully bypassed.
 */
export async function authorizeAgentKey(
  client: TempoWalletClient,
  rootAccount: TempoRoot,
  spec: AuthorizedKeySpec,
): Promise<AuthorizedKey> {
  const keyPriv = generatePrivateKey()
  const keyId = privateKeyToAddress(keyPriv)
  const accessKey = Account.fromSecp256k1(keyPriv, { access: rootAccount })

  const txHash = await Actions.accessKey.authorize(client, {
    accessKey,
    expiry: spec.expiry ?? Math.floor(Date.now() / 1000) + 30 * 86_400,
    limits: spec.limitUnits
      ? [{ token: PATHUSD, limit: spec.limitUnits, period: spec.periodSeconds ?? 86_400 }]
      : undefined,
    scopes: [
      {
        address: PATHUSD,
        selector: 'transfer(address,uint256)',
        recipients: spec.recipientAllowlist && spec.recipientAllowlist.length > 0
          ? spec.recipientAllowlist
          : undefined,
      },
    ],
    witness: witnessFor(spec.name),
  })

  return {
    name: spec.name,
    keyId,
    root: rootAccount.address,
    privateKey: keyPriv,
    accessKey,
    txHash,
  }
}

/** Read the on-chain remaining period allowance for a key (TIP-20), in units. */
export async function remainingLimit(
  client: TempoPublicClient,
  key: AuthorizedKey,
): Promise<{ remaining: bigint; periodEnd: bigint }> {
  const res = await client.readContract({
    address: Addresses.accountKeychain,
    abi: Abis.accountKeychain,
    functionName: 'getRemainingLimitWithPeriod',
    args: [key.root, key.keyId, PATHUSD],
  })
  return { remaining: res[0], periodEnd: res[1] }
}

/** Whether a key authorization still exists on-chain for this account. */
export async function keyStatus(
  client: TempoPublicClient,
  key: AuthorizedKey,
): Promise<{ exists: boolean; revoked: boolean; expiry: bigint }> {
  const res = await client.readContract({
    address: Addresses.accountKeychain,
    abi: Abis.accountKeychain,
    functionName: 'getKey',
    args: [key.root, key.keyId],
  })
  return {
    exists: res.keyId === key.keyId,
    revoked: res.isRevoked,
    expiry: res.expiry,
  }
}