import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { evaluate, DEFAULT_POLICY, usd, type SpendRequest, type SpendSnapshot, type Category } from '@zspend/policy'
import { SimAdapter } from './adapters/sim'
import type { KeyState, SpendReceipt } from './adapters/chain'
import './style.css'

const adapter = new SimAdapter()

function App() {
  const [key, setKey] = useState<KeyState | null>(null)
  const [balanceUnits, setBalance] = useState(BigInt('200000000')) // $200.00 preload
  const [history, setHistory] = useState<(SpendReceipt & { req: SpendRequest; verdict: string })[]>([])
  const [fields, setFields] = useState<{ id: string; category: Category; recipient: string; amount: string }>({
    id: 'pay-004',
    category: 'ops',
    recipient: 'grants.ops',
    amount: '0',
  })

  useEffect(() => {
    void adapter.authorize({ name: 'agent-ops', limitUnits: BigInt('100000000'), periodSeconds: 86400, scope: 'transfer' }).then(setKey)
  }, [])

  async function run() {
    const amountUnits = BigInt(Math.round(parseFloat(fields.amount) * 1e6))
    const req: SpendRequest = {
      id: fields.id,
      category: fields.category,
      recipient: fields.recipient,
      amountUnits,
      memo: 'dashboard',
    }
    const empty: SpendSnapshot = { byCategory: { ops: 0n, marketing: 0n, engineering: 0n }, byRecipient: {} }
    const verdict = evaluate(DEFAULT_POLICY, empty, req)
    if (verdict.decision === 'REJECT') {
      setHistory(h => [
        ...h,
        { req, amountUnits, verdict: 'POLICY REJECT — no tx sent', txHash: undefined, confirmed: false, id: req.id },
      ])
      return
    }
    if (verdict.decision === 'APPROVE') {
      const receipt = await adapter.execute(req.id, amountUnits)
      if (receipt.confirmed) setBalance(b => b - amountUnits)
      setHistory(h => [...h, { req, verdict: receipt.confirmed ? 'APPROVE + chain confirm' : 'APPROVE but CHAIN-BLOCKED', ...receipt }])
      const a = await adapter.allowance()
      setKey(k => (k ? { ...k, remainingUnits: a.remainingUnits } : k))
    }
  }

  const rem = key ? usd(key.remainingUnits) : '—'
  const lim = key ? usd(key.limitUnits) : '—'

  return (
    <main className="wrap">
      <header><h1>Z-Spend Control Plane</h1><p>policy gate → access-key limit → chain enforcement, live in a browser</p></header>

      <section className="card grid3">
        <div><label>balance</label><b>{usd(balanceUnits)}</b></div>
        <div><label>key limit (on-chain)</label><b>{lim}</b></div>
        <div><label>remaining allowance</label><b className={rem === '0.000000' ? 'red' : ''}>{rem}</b></div>
      </section>

      <section className="card">
        <h2>Spend request</h2>
        <div className="row">
          <input value={fields.id} onChange={e => setFields({ ...fields, id: e.target.value })} placeholder="id" />
          <select value={fields.category} onChange={e => setFields({ ...fields, category: e.target.value as never })}>
            <option value="ops">ops</option><option value="marketing">marketing</option><option value="engineering">engineering</option>
          </select>
          <input value={fields.recipient} onChange={e => setFields({ ...fields, recipient: e.target.value })} placeholder="recipient" />
          <input value={fields.amount} onChange={e => setFields({ ...fields, amount: e.target.value })} placeholder="amount (USD)" inputMode="decimal" />
          <button onClick={() => void run()}>Propose</button>
        </div>
      </section>

      <section className="card">
        <h2>Ledger timeline</h2>
        {history.length === 0 && <p className="dim">No spends yet — try $80 ops (approve), $160 marketing (policy reject), then a $100 ops after the key is drained (chain block).</p>}
        <ul className="ledger">
          {history.map((h, i) => (
            <li key={i}>
              <span className={h.verdict.includes('REJECT') || h.verdict.includes('BLOCKED') ? 'tag red' : 'tag green'}>{h.verdict}</span>
              <code>{h.req.id}</code> <span>{h.req.category}</span> <b>{usd(h.amountUnits)}</b>
              <code className="dim">{h.txHash ?? '—'}</code>
            </li>
          ))}
        </ul>
      </section>

      <footer className="dim">{adapter.chainLabel()} · v2 control-plane (Eternal) · engine: src/policy.ts</footer>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)