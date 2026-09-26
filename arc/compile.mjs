import solc from 'solc'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

const sources = {
  'AgentBudget.sol': readFileSync(resolve(here, 'contracts/AgentBudget.sol'), 'utf8'),
  'MockUSDC.sol': readFileSync(resolve(here, 'contracts/test/MockUSDC.sol'), 'utf8'),
}

const input = {
  language: 'Solidity',
  sources: Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, { content: v }])),
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
  },
}

const out = JSON.parse(solc.compile(JSON.stringify(input)))

const fatal = (out.errors ?? []).filter((e) => e.severity === 'error')
const warns = (out.errors ?? []).filter((e) => e.severity === 'warning')

for (const w of warns) console.warn('warn:', w.formattedMessage.trim())
if (fatal.length) {
  for (const e of fatal) console.error(e.formattedMessage)
  process.exit(1)
}

mkdirSync(resolve(here, 'artifacts'), { recursive: true })

for (const [file, contracts] of Object.entries(out.contracts)) {
  for (const [name, c] of Object.entries(contracts)) {
    const artifact = {
      contractName: name,
      sourceName: file,
      solcVersion: solc.version(),
      abi: c.abi,
      bytecode: '0x' + c.evm.bytecode.object,
      deployedBytecode: '0x' + c.evm.deployedBytecode.object,
      createdAt: new Date().toISOString(),
    }
    writeFileSync(resolve(here, `artifacts/${name}.json`), JSON.stringify(artifact, null, 2))
    console.log(
      `${name}: runtime ${c.evm.deployedBytecode.object.length / 2}B, deploy ${(c.evm.bytecode.object.length - 2) / 2}B, ${c.abi.length} ABI entries`,
    )
  }
}
console.log('arc mainnet USDC: 0x3600000000000000000000000000000000000000 (chain 5042)')