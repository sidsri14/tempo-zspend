/** Chain adapter interface — one enforcement story, many chains.
 * Tempo = production adapter (viem/tempo access keys, see src/keychain.ts).
 * Sim   = deterministic no-network adapter for the control-plane dashboard.
 */
export interface KeyAuthorize {
  name: string
  /** spend limit in base units over the period */
  limitUnits: bigint
  periodSeconds: number
  scope: 'transfer'
}

export interface KeyState {
  name: string
  keyId: string
  limitUnits: bigint
  remainingUnits: bigint
  scope: 'transfer'
  authorized: boolean
  txHash?: string
}

export interface SpendReceipt {
  id: string
  amountUnits: bigint
  txHash?: string
  confirmed: boolean
}

export interface ChainAdapter {
  readonly id: 'tempo' | 'sim'
  authorize(spec: KeyAuthorize): Promise<KeyState>
  allowance(): Promise<{ limitUnits: bigint; remainingUnits: bigint }>
  execute(id: string, amountUnits: bigint): Promise<SpendReceipt>
  // TEMPO-ONLY: viem access key (from src/chain.ts); sim keeps its own state capsule.
  chainLabel(): string
}