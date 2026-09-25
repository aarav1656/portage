> **Status:** devnet only, not on mainnet. Program `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V`. Upgrade authority on devnet: none (immutable). Source commit `ae25a85` (program unchanged since the devnet run at `6b3db36`). Read 2026-09-25.

# `@portage/dbc`

Source: `packages/dbc/src/index.ts`. Private workspace package, consumed as TypeScript source. Depends on `@meteora-ag/dynamic-bonding-curve-sdk` pinned at 1.5.12, `@solana/web3.js` ^1.98.4, `@solana/spl-token` ^0.4.13. This package does not call the Portage program; it builds Meteora DBC transactions for a quote mint you pass in, normally a Portage wrapped mint.

## Exports

### `TESSERA_API`

`"https://rest-api.tessera.pe/v1/public/token-details"`. Also imported by `web/lib/market.ts`.

### `tesseraMarkPrice(code: string): Promise<number>`

Fetches `TESSERA_API`, finds the row whose `code` equals the argument (for example `"tKalshi"`), returns its `markPrice` in USD. Throws `tessera <status>` on a non-2xx response and `tessera: no <code>` if the row is missing. No cache and no fallback here; the web app's stale-cache fallback lives in `web/lib/market.ts`, not in this package.

### `LaunchParams`

| Field | Type | Meaning |
|---|---|---|
| `quoteMint` | `PublicKey` | The quote mint for the pool, normally a Portage wrapped mint |
| `quoteDecimals` | `TokenDecimal` | Decimals of the quote mint (the T-Tokens and their wrapped mints use 9) |
| `quoteUsd` | `number` | USD per whole quote token, used to express market caps in quote units |
| `startMarketCapUsd` | `number` | Market cap at the first trade |
| `graduateMarketCapUsd` | `number` | Market cap at which the pool migrates |

### `portageCurve(p: LaunchParams)`

Calls the SDK's `buildCurveWithMarketCap` with fixed Portage settings and returns the SDK's config parameters object. `initialMarketCap = startMarketCapUsd / quoteUsd` and `migrationMarketCap = graduateMarketCapUsd / quoteUsd`, so both are in quote-token units. `quoteMint` is not read by this function. Every fixed setting, and the resulting on-chain fields, are listed in [Launch a DBC pool](../guides/launch-a-dbc-pool.md#curve-and-fee-parameters).

### `buildLaunchTx(connection, p): Promise<Transaction>`

`p` is `LaunchParams` plus:

| Field | Type | Used as |
|---|---|---|
| `config` | `PublicKey` | Address of the new DBC config account (must sign if the transaction is sent) |
| `baseMint` | `PublicKey` | Address of the new token mint (must sign if sent) |
| `partner` | `PublicKey` | `feeClaimer` and `leftoverReceiver` of the config |
| `creator` | `PublicKey` | `poolCreator` |
| `payer` | `PublicKey` | Fee and rent payer |
| `name`, `symbol`, `uri` | `string` | Base token metadata |

It constructs `new DynamicBondingCurveClient(connection, "confirmed")` and returns `client.partner.createConfigAndPool({...portageCurve(p), config, feeClaimer, leftoverReceiver, quoteMint, payer, preCreatePoolParam})`. The result is one legacy `Transaction` with two instructions, `CreateConfig` and `InitializeVirtualPoolWithSplToken` (visible in the simulation logs on [the rejection page](../concepts/why-dbc-rejects-fee-quotes.md#live-evidence)). The SDK reads the quote mint on chain while building, so the quote mint must already exist on the target cluster (comment in `packages/dbc/src/sim.ts`).

The transaction is unsigned. To send it, the payer, `config`, and `baseMint` keypairs must sign, as `packages/dbc/src/devnet.ts` does.

## Scripts in the package

Not exported; run with `tsx`.

| Script | Command | What it does |
|---|---|---|
| `packages/dbc/src/sim.ts` | `pnpm sim green` or `pnpm sim red` in `packages/dbc` | Mainnet `simulateTransaction` with `sigVerify: false` of `buildLaunchTx`, quote JitoSOL (green) or raw tKalshi (red). Nothing is signed or sent. Env: `RPC_URL`, `SIM_PAYER` |
| `packages/dbc/src/devnet.ts` | `KEYPAIR=... STATE=... npx tsx src/devnet.ts <step>` | Devnet only. Steps `raw-launch`, `init-vault`, `wrap`, `launch`, `buy`, `unwrap`. See [Reproduce the devnet run](../guides/reproduce-the-devnet-run.md) |

The package has no test suite of its own. The curve math is exercised by `web/lib/curve.ts` (preview) and by the simulations.
