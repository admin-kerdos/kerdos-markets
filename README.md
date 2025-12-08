# Kérdos Markets 

Kérdos Markets is a Solana-native central limit order book (CLOB) that keeps matching logic, balances, and settlement on chain while exposing a web app, CLI, and SDK for traders and integrators.

## What is Kérdos Markets?

- A permissionless spot exchange where every market is defined by a base/quote mint pair and enforced by the on-chain program in `programs/CLOB`.
- A Next.js front end plus `@kerdos/sdk` and `@kerdos/cli` packages that let wallets, market makers, or bots interact with the protocol using familiar TypeScript APIs.
- A self-custodial system: users hold their keys and only sign the instructions required to deposit funds, place/cancel orders, and settle fills.

## How it works

1. The Anchor program (`programs/CLOB`) creates markets, vaults, and user balance PDAs, and executes the deterministic CLOB matching/settlement logic.
2. Traders connect a Solana wallet in the web app, use the SDK/CLI to deposit base and quote tokens into market-specific vaults, and sign place/cancel instructions.
3. Matching runs inside the program: filled orders emit events that are later settled on chain, and scripts such as `scripts/seed-local.ts` or `scripts/seed-markets.ts` help spin up local or devnet markets for testing.

