# Metropolis Portal Copy

Use this only after the `monad/` directory is pushed to the linked repository.
Do not claim a testnet deployment until `deploy-testnet.mjs` produces a transaction
receipt and contract address.

## Tagline

Native-MON escrow with hard rolling budgets for autonomous agents on Monad.

## Description

Monad SpendGuard is a small EVM contract for giving an autonomous agent a
strict, revocable spend allowance. The owner deposits MON into the contract,
authorizes an agent with a rolling budget, and can update or revoke that
allowance at any time.

When an agent calls `spend`, the contract fails closed unless the agent is
active, the request fits within its current-window allowance, and the escrow
has sufficient MON. A successful call transfers native MON to the specified
recipient and records the remaining allowance. The owner can recover unused
escrow, but agents cannot bypass their configured limit.

The project is intentionally narrow: it demonstrates enforceable on-chain
budget controls, not an off-chain simulation service or a deployed production
gateway.

## Verification

```bash
git clone https://github.com/sidsri14/tempo-zspend.git
cd tempo-zspend/monad
npm install
npm run compile
npm test
```

The local EVM suite covers six cases: authorization, native-MON payout,
over-budget rejection, revocation, rolling-window reset, and escrow-protected
owner withdrawal.

## Testnet deployment

The included deployment script verifies Monad testnet chain ID `10143` through
`https://testnet-rpc.monad.xyz`. It needs only a disposable testnet wallet
funded from the official faucet:

```powershell
$env:MONAD_TESTNET_PRIVATE_KEY = '0x...'
npm run deploy:testnet
```

Record the resulting transaction hash and contract address here only after a
successful receipt is returned.
