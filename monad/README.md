# Monad SpendGuard

`MonadSpendGuard` is a native-MON escrow contract for autonomous agents. The owner funds the contract, authorizes an agent with a rolling limit, and can revoke or update that limit at any time. The contract fails closed when an inactive agent, an over-budget request, or insufficient escrow is encountered.

## Verify locally

```bash
cd monad
npm run compile
npm test
```

The tests use a local EVM to cover authorization, native-MON payout, quota exhaustion, revocation, window reset, and escrow protection.

## Deploy to Monad testnet

The deploy script validates the official Monad testnet RPC and requires a separate, throwaway test wallet funded from the faucet. It never reads or writes a committed key file.

```bash
cd monad
npm run compile
$env:MONAD_TESTNET_PRIVATE_KEY = '0x...'
npm run deploy:testnet
```

The current state is **local verification only** until a deployment transaction and contract address are recorded. Do not describe it as deployed before then.
