> **Status:** devnet only, not on mainnet. Program `AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V`. Upgrade authority on devnet: none (immutable). Source commit `ae25a85` (program unchanged since the devnet run at `6b3db36`). Read 2026-09-25.

# Launch a DBC pool quoted in a wrapped T-Token

A launch is a Meteora DBC config plus a virtual pool whose quote mint is a Portage wrapped mint. Portage's program is not involved in the launch transaction; it only has to have created the wrapped mint (`init_vault`) and someone has to hold wrapped tokens to buy with.

On mainnet no wrapped mint exists yet, so the web configurator previews and simulates with a stand-in quote. The only real launch so far is on devnet (`DEVNET.md` step 5a, pool `8GN2C1Ryn5hjLzAs9ncpYbNyXd63rynhv4E1KZRHpQ1Q`).

## From the web configurator (`/launch`)

Files: `web/app/launch/page.tsx`, `web/components/launch-configurator.tsx`, `web/lib/curve.ts`, `web/components/launch-sim-panel.tsx`, `web/app/api/launch-sim/route.ts`.

1. The page reads `fetchMarketSnapshot()` on the server (`web/lib/market.ts`): Tessera mark price, and the live mint decimals and fee for tKalshi and tOpenAI.
2. Inputs: token name (32 characters max), symbol (10 max, upper-cased), quote (wtKALSHI or wtOPENAI), starting market cap in USD (default 10000), graduation market cap in USD (default 100000). Supply is fixed at 1,000,000,000 by `portageCurve` and shown disabled.
3. Preview, computed in the browser by `buildLaunchPreview` in `web/lib/curve.ts`:
   - calls `portageCurve` with the selected quote's mark price and decimals;
   - plots price against tokens sold, sampled 24 points per curve segment with the SDK's `getDeltaAmountBaseUnsigned`, clipped at the graduation price from `getCurveBreakdown`;
   - plots the base fee for each scheduler period with the SDK's `getBaseFeeNumeratorByPeriod`.
   It rejects quote decimals outside 6 to 9, a non-positive mark or start market cap, and a graduation market cap not above the start.
4. Simulate: calls `GET /api/launch-sim?name=&symbol=&supply=&startMcapUsd=`. The route builds `buildLaunchTx` and runs mainnet `simulateTransaction` with `sigVerify: false`. It returns `err`, `logs`, `unitsConsumed`, `startPriceUsd` (`startMcapUsd / supply`), `anchor.tesseraMarkPrice`, `anchor.fetchedAt`, `anchor.stale`, and `simulatedAt`.

What the simulate step does not reflect, from `web/app/api/launch-sim/route.ts`:

- The quote mint is always JitoSOL (`J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn`), and the price anchor is always the tKalshi mark, whichever quote is selected.
- The graduation market cap is always `startMcapUsd * 10`; the graduation input is not sent.

The web app has no control that sends a real launch. Nothing in `web/` signs a DBC transaction.

Example preview output for tKalshi at a $413.8 mark, $10,000 start, $100,000 graduation (computed 2026-09-25 with `buildLaunchPreview`): start price $0.00001, graduation price $0.0001 after 759,746,911.68 tokens sold, base fee 2500 bps at 0 s, 855 at 100 s, 292 at 200 s, 100 at 300 s.

## Curve and fee parameters

`portageCurve` (`packages/dbc/src/index.ts` L48-L97) passes these fixed settings to the SDK's `buildCurveWithMarketCap`. The right-hand column is the resulting DBC config field, printed on 2026-09-25 from `portageCurve({ quoteDecimals: 9, quoteUsd: 413.8, startMarketCapUsd: 10000, graduateMarketCapUsd: 100000 })` with SDK 1.5.12. Enum values are as the SDK encodes them.

| `portageCurve` setting | Value | Config field | Printed value |
|---|---|---|---|
| `token.tokenType` | `TokenType.SPLToken` | `tokenType` | `0` |
| `token.tokenBaseDecimal` | `TokenDecimal.SIX` | `tokenDecimal` | `6` |
| `token.tokenAuthorityOption` | `TokenAuthorityOption.Immutable` | `tokenUpdateAuthority` | `1` |
| `token.totalTokenSupply`, `leftover` | 1,000,000,000 and 0 | `tokenSupply.preMigrationTokenSupply`, `postMigrationTokenSupply` | `1000000000000000` each (base units) |
| `fee.baseFeeParams` | `BaseFeeMode.FeeSchedulerExponential`, 2500 to 100 bps, 30 periods, 300 s | `poolFees.baseFee` | `cliffFeeNumerator 250000000`, `firstFactor 30` (periods), `secondFactor 10` (seconds per period), `thirdFactor 1017` (reduction factor), `baseFeeMode 1` |
| `fee.dynamicFeeEnabled` | `true` | `poolFees.dynamicFee` | `binStep 1`, `filterPeriod 10`, `decayPeriod 120`, `reductionFactor 5000`, `maxVolatilityAccumulator 14460000`, `variableFeeControl 956` |
| `fee.collectFeeMode` | `CollectFeeMode.QuoteToken` | `collectFeeMode` | `0` |
| `fee.creatorTradingFeePercentage` | 50 | `creatorTradingFeePercentage` | `50` |
| `fee.poolCreationFee` | 0 | `poolCreationFee` | `0` |
| `fee.enableFirstSwapWithMinFee` | `false` | `enableFirstSwapWithMinFee` | `false` |
| `migration.migrationOption` | `MigrationOption.MET_DAMM_V2` | `migrationOption` | `1` |
| `migration.migrationFeeOption` | `MigrationFeeOption.Customizable` | `migrationFeeOption` | `6` |
| `migration.migrationFee` | 0 %, creator 0 % | `migrationFee` | `feePercentage 0`, `creatorFeePercentage 0` |
| `migration.migratedPoolFee` | `MigratedCollectFeeMode.Compounding`, `DammV2DynamicFeeMode.Enabled`, 100 bps, `compoundingFeeBps` 5000 | `migratedPoolFee`, `compoundingFeeBps` | `collectFeeMode 2`, `dynamicFee 1`, `poolFeeBps 100`; `compoundingFeeBps 5000` |
| `liquidityDistribution` | partner and creator permanently locked 50 % each, unlocked 0 % | `partnerPermanentLockedLiquidityPercentage`, `creatorPermanentLockedLiquidityPercentage`, `partnerLiquidityPercentage`, `creatorLiquidityPercentage` | `50`, `50`, `0`, `0` |
| `lockedVesting` | all zero | `lockedVesting` | all `0` |
| `activationType` | `ActivationType.Timestamp` | `activationType` | `1` |
| `initialMarketCap` | `startMarketCapUsd / quoteUsd` | `sqrtStartPrice` | `90682709498442681` |
| `migrationMarketCap` | `graduateMarketCapUsd / quoteUsd` | `migrationQuoteThreshold` | `58060191723` (58.06 quote tokens at 9 decimals) |
| (derived) | | `curve` | 2 segments |

`tokenQuoteDecimal` is set from `quoteDecimals` and only affects the price math. The rationale for the settings is the doc comment above `portageCurve`: a 1 % fee floor sits above the roughly 40 bps wrap-plus-unwrap round-trip cost, the exponential schedule is anti-snipe, and quote-denominated fees accrue as T-Token exposure.

## From TypeScript

The only code path in the repository that sends a launch is the `launch` step of `packages/dbc/src/devnet.ts`. Reduced to its parts, given a `Connection` `conn`, a funded `Keypair` `payer`, and the underlying mint `underlyingMint`:

```ts
import { Keypair, sendAndConfirmTransaction } from "@solana/web3.js";
import { TokenDecimal, deriveDbcPoolAddress } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { buildLaunchTx, tesseraMarkPrice } from "@portage/dbc";
import { vaultAddresses } from "@portage/vault";

const { wrappedMint } = vaultAddresses(underlyingMint);     // quote = Portage wrapped mint
const config = Keypair.generate();
const baseMint = Keypair.generate();
const tx = await buildLaunchTx(conn, {
  quoteMint: wrappedMint,
  quoteDecimals: TokenDecimal.NINE,
  quoteUsd: await tesseraMarkPrice("tKalshi"),
  startMarketCapUsd: 10_000,
  graduateMarketCapUsd: 100_000,
  config: config.publicKey,
  baseMint: baseMint.publicKey,
  partner: payer.publicKey,
  creator: payer.publicKey,
  payer: payer.publicKey,
  name: "Portage Devnet",
  symbol: "PTGD",
  uri: "https://example.org/ptgd.json",
});
const pool = deriveDbcPoolAddress(wrappedMint, baseMint.publicKey, config.publicKey);
await sendAndConfirmTransaction(conn, tx, [payer, config, baseMint], { commitment: "confirmed" });
```

Preconditions:

- The vault for `underlyingMint` exists on the target cluster (the SDK reads the quote mint while building).
- To buy on the pool you need wrapped tokens, so `wrap` first. `devnet.ts` `buy` then calls `client.pool.swap({ owner, pool, amountIn, minimumAmountOut, swapBaseForQuote: false, referralTokenAccount: null })`.

To check a configuration against mainnet before any wrapped mint exists, run `pnpm sim green` in `packages/dbc` (JitoSOL stand-in) or call `/api/launch-sim`.
