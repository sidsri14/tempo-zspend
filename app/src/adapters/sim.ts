import type { ChainAdapter, KeyAuthorize, KeyState, SpendReceipt } from './chain'

/** Deterministic no-network adapter: mirrors the access-key budget story (v1 demo:
 * pay-001 APPROVE → $80, pay-002 REJECT → $160 marketing, pay-003 chain-blocked $100
 * once the key's on-chain allowance is exhausted). Judge-safe: no faucet, no RPC.
 */
export class SimAdapter implements ChainAdapter {
  readonly id = 'sim' as const
  private limitUnits: bigint = 0n
  private remainingUnits: bigint = 0n
  private state: KeyState | null = null

  async authorize(spec: KeyAuthorize): Promise<KeyState> {
    this.limitUnits = spec.limitUnits
    this.remainingUnits = spec.limitUnits
    this.state = {
      name: spec.name,
      keyId: '0xSIM00000000000000000000000000000000000001',
      limitUnits: spec.limitUnits,
      remainingUnits: spec.limitUnits,
      scope: 'transfer',
      authorized: true,
      txHash: '0xsim_authorize_' + spec.name.replace(/\W+/g, ''),
    }
    return this.state
  }

  async allowance(): Promise<{ limitUnits: bigint; remainingUnits: bigint }> {
    return { limitUnits: this.limitUnits, remainingUnits: this.remainingUnits }
  }

  /** Policy-approved spend: consume the chain limit; over-limit → chain block,
   *  exactly like the Tempo access-key revert (0x8a9e71ea). */
  async execute(id: string, amountUnits: bigint): Promise<SpendReceipt> {
    if (this.remainingUnits >= amountUnits) {
      this.remainingUnits -= amountUnits
      return { id, amountUnits, txHash: '0xsim_exec_' + id.replace(/\W+/g, ''), confirmed: true }
    }
    return { id, amountUnits, txHash: '0x8a9e71ea(chain-block)', confirmed: false }
  }

  chainLabel(): string {
    return 'Sim adapter — deterministic, no network'
  }
}