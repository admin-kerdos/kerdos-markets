# Kérdos Markets Web

Kérdos Markets is a Solana-native central limit order book (CLOB) that keeps matching logic, balances, and settlement on chain while exposing a web app, CLI, and SDK for traders and integrators.

## What is Kérdos Markets?

- A permissionless spot exchange where every market is defined by a base/quote mint pair and enforced by the on-chain program in `programs/CLOB`.
- A Next.js front end plus `@kerdos/sdk` and `@kerdos/cli` packages that let wallets, market makers, or bots interact with the protocol using familiar TypeScript APIs.
- A self-custodial system: users hold their keys and only sign the instructions required to deposit funds, place/cancel orders, and settle fills.

## How it works

1. The Anchor program (`programs/CLOB`) creates markets, vaults, and user balance PDAs, and executes the deterministic CLOB matching/settlement logic.
2. Traders connect a Solana wallet in the web app, use the SDK/CLI to deposit base and quote tokens into market-specific vaults, and sign place/cancel instructions.
3. Matching runs inside the program: filled orders emit events that are later settled on chain, and scripts such as `scripts/seed-local.ts` or `scripts/seed-markets.ts` help spin up local or devnet markets for testing.

## Email sign-in (Magic Link)

Magic Link sign-in is disabled by default. To enable it, provide the following environment variables (see `.env.example`):

```
EMAIL_SIGNIN_ENABLED=true
EMAIL_FROM="Kérdos <no-reply@tudominio.com>"
EMAIL_SERVER=smtps://USER:PASS@smtp.example.com:465
# or, alternatively
# RESEND_API_KEY=your-resend-key
```

- **Token TTL**: 15 minutes. Links are single-use and the token is invalidated after the first successful verification.
- **Rate limits**: 1 request per 30 seconds per IP+email pair and up to 5 emails per hour. Exceeding the limit returns HTTP 429 with a short cooldown message.
- **Delivery**: Provide either an SMTP URI (`EMAIL_SERVER`) or a Resend API key. For SMTP delivery install `nodemailer` in your project (`npm install nodemailer`). In CI/tests you can set `EMAIL_DISABLE_DELIVERY=true` to skip actual delivery.
- **Local testing**: Run Playwright (`npx playwright test`) to exercise the full spectrum, including success, cooldown, and expiry paths. The UI shows a resend countdown and handles expired links via a modal toast.
- **Security**: Ensure `NEXTAUTH_URL` matches the public origin and use a strong `NEXTAUTH_SECRET`. Magic-link cookies remain httpOnly with CSRF protection.
