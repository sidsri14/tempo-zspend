import solc from 'solc'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const sourceName = 'MonadSpendGuard.sol'
const input = {
  language: 'Solidity',
  sources: { [sourceName]: { content: readFileSync(resolve(here, 'contracts', sourceName), 'utf8') } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
  },
}

const output = JSON.parse(solc.compile(JSON.stringify(input)))
const errors = (output.errors ?? []).filter((entry) => entry.severity === 'error')
if (errors.length) {
  for (const error of errors) console.error(error.formattedMessage)
  process.exit(1)
}

const contract = output.contracts[sourceName].MonadSpendGuard
const artifact = {
  contractName: 'MonadSpendGuard',
  sourceName,
  solcVersion: solc.version(),
  abi: contract.abi,
  bytecode: `0x${contract.evm.bytecode.object}`,
  deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
}
mkdirSync(resolve(here, 'artifacts'), { recursive: true })
writeFileSync(resolve(here, 'artifacts', 'MonadSpendGuard.json'), JSON.stringify(artifact, null, 2))
console.log(`MonadSpendGuard: runtime ${contract.evm.deployedBytecode.object.length / 2}B`)
