# BOBC Pay

Mobile-first BOBC wallet app for Arbitrum One. Sign in with Privy email or an external wallet, see your BOBC balance, scan or share BOBC payment QRs, and redeem BOBC for crvUSD.

## Local development

1. `npm install`
2. Copy `.env.example` to `.env.local` and set `VITE_PRIVY_APP_ID`.
3. Run `npm run dev`.

Set `VITE_VAULT_ENGINE_ADDRESS` after BOBC is deployed on Arbitrum One. The app verifies the engine, its BOBC token, crvUSD asset, and oracle before enabling transactions. Until then, it shows a deployment notice. `VITE_ARBITRUM_RPC_URL` is optional.

## Privy setup

Enable email and wallet login in the Privy dashboard. Configure embedded Ethereum wallets for email users. For gas sponsorship, enable **App pays** on Arbitrum One, allow client-initiated transactions, set billing and spending controls, and use TEE wallet execution. The app requests sponsored gas only when the selected wallet is a Privy embedded wallet associated with email login. External wallet transactions are not sponsored and require Arbitrum ETH.

## Payment format

Receive QRs use ERC-681 BOBC transfer requests on chain 42161, with an optional token amount in base units. Pay accepts those requests or a plain EVM address. Other tokens, chains, and unsupported QR parameters are rejected. Payments call `BOBC.transfer` directly; the Cashback contract is not used.

## Commands

- `npm run dev` — local server
- `npm run format` — format project files with Oxfmt
- `npm run format:check` — check formatting
- `npm run lint` — lint with Oxlint
- `npm run lint:fix` — apply safe Oxlint fixes
- `npm test` — unit tests
- `npm run typecheck` — TypeScript check
- `npm run build` — production build

Transactions are simulated before signing. A broadcast hash is shown as pending until a receipt confirms or reverts. Pending hashes persist locally across navigation and refresh. Live transaction testing needs deployed BOBC contracts and a configured Privy app.

## Cloudflare deployment

Run `pnpm deploy` (or `cf deploy`) from this directory. The worker name and runtime settings are defined in `cloudflare.config.ts`. Build-time `VITE_*` values are loaded by Vite from the local environment files.
