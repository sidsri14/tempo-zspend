import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Category } from './policy.js'

export interface LedgerEntry {
  id: string
  ts: number
  category: Category
  recipient: string
  amountUnits: string
  token: string
  verdict: 'APPROVE' | 'REJECT'
  reason: string
  txHash?: string
  executed?: boolean
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const LEDGER_DIR = join(__dirname, '..', '.zspend')
const LEDGER_PATH = join(LEDGER_DIR, 'ledger.jsonl')

function ensureDir() {
  if (!existsSync(LEDGER_DIR)) mkdirSync(LEDGER_DIR, { recursive: true })
}

export function append(entry: LedgerEntry): void {
  ensureDir()
  appendFileSync(LEDGER_PATH, JSON.stringify(entry) + '\n', 'utf8')
}

/** Move the current ledger aside so a fresh demo run starts with a clean window. */
export function reset(): void {
  ensureDir()
  if (existsSync(LEDGER_PATH)) {
    const backup = `${LEDGER_PATH}.${new Date().toISOString().replace(/[:.]/g, '-')}`
    renameSync(LEDGER_PATH, backup)
  }
}

export function readAll(): LedgerEntry[] {
  if (!existsSync(LEDGER_PATH)) return []
  return readFileSync(LEDGER_PATH, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as LedgerEntry)
}

const DAY_MS = 86_400_000

function startOfToday(now = Date.now()): number {
  return Math.floor(now / DAY_MS) * DAY_MS
}

/** Buckets of APPROVED-and-executed spend within the current wallet-day. */
export function todaySnapshot(): { byCategory: Record<Category, bigint>; byRecipient: Record<string, bigint> } {
  const start = startOfToday()
  const byCategory = {} as Record<Category, bigint>
  const byRecipient: Record<string, bigint> = {}

  for (const e of readAll()) {
    if (e.executed !== true) continue
    if (e.ts < start) continue
    const units = BigInt(e.amountUnits)
    byCategory[e.category] = (byCategory[e.category] ?? 0n) + units
    byRecipient[e.recipient] = (byRecipient[e.recipient] ?? 0n) + units
  }
  return { byCategory, byRecipient }
}