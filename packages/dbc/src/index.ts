import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  DammV2DynamicFeeMode,
  DynamicBondingCurveClient,
  MigratedCollectFeeMode,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  buildCurveWithMarketCap,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

export const TESSERA_API = "https://rest-api.tessera.pe/v1/public/token-details";

/** Tessera's mark price for a T-Token, in USD. */
export async function tesseraMarkPrice(code: string): Promise<number> {
  const res = await fetch(TESSERA_API);
  if (!res.ok) throw new Error(`tessera ${res.status}`);
  const rows = (await res.json()) as { code: string; markPrice: number }[];
  const row = rows.find((r) => r.code === code);
  if (!row) throw new Error(`tessera: no ${code}`);
  return row.markPrice;
}

export type LaunchParams = {
  quoteMint: PublicKey;
  quoteDecimals: TokenDecimal;
  /** USD per whole quote token, used to express the curve in quote units. */
  quoteUsd: number;
  startMarketCapUsd: number;
  graduateMarketCapUsd: number;
};

/**
 * Curve and fees for a launch quoted in a wrapped T-Token.
 * The quote is a pre-IPO share that reprices on private rounds and news, and every
 * wrap/unwrap already pays 20 bps each way, so:
 * - the base fee never decays below 1% (well above the 40 bps round-trip wrap cost),
 * - an exponential anti-snipe schedule starts at 25% and decays over the first 5 minutes,
 * - the dynamic fee widens the spread when the curve moves fast,
 * - fees are collected in the quote so they accrue as T-Token exposure,
 * - after graduation the DAMM v2 pool compounds fees back into liquidity and all LP is locked.
 */
export function portageCurve(p: LaunchParams) {
  return buildCurveWithMarketCap({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: p.quoteDecimals,
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: 1_000_000_000,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerExponential,
        feeSchedulerParam: { startingFeeBps: 2500, endingFeeBps: 100, numberOfPeriod: 30, totalDuration: 300 },
      },
      dynamicFeeEnabled: true,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: 50,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.Customizable,
      migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
      migratedPoolFee: {
        collectFeeMode: MigratedCollectFeeMode.Compounding,
        dynamicFee: DammV2DynamicFeeMode.Enabled,
        poolFeeBps: 100,
        compoundingFeeBps: 5000,
      },
    },
    liquidityDistribution: {
      partnerPermanentLockedLiquidityPercentage: 50,
      partnerLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 50,
      creatorLiquidityPercentage: 0,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Timestamp,
    initialMarketCap: p.startMarketCapUsd / p.quoteUsd,
    migrationMarketCap: p.graduateMarketCapUsd / p.quoteUsd,
  });
}

/** createConfig + initializeVirtualPool quoted in `quoteMint`, as one transaction. */
export async function buildLaunchTx(
  connection: Connection,
  p: LaunchParams & {
    config: PublicKey;
    baseMint: PublicKey;
    partner: PublicKey;
    creator: PublicKey;
    payer: PublicKey;
    name: string;
    symbol: string;
    uri: string;
  },
): Promise<Transaction> {
  const client = new DynamicBondingCurveClient(connection, "confirmed");
  return client.partner.createConfigAndPool({
    config: p.config,
    feeClaimer: p.partner,
    leftoverReceiver: p.partner,
    quoteMint: p.quoteMint,
    payer: p.payer,
    ...portageCurve(p),
    preCreatePoolParam: {
      name: p.name,
      symbol: p.symbol,
      uri: p.uri,
      poolCreator: p.creator,
      baseMint: p.baseMint,
    },
  });
}
