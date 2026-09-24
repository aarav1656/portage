import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import {
  type BaseFeeMode,
  Rounding,
  type TokenDecimal,
  feeNumeratorToBps,
  getBaseFeeNumeratorByPeriod,
  getCurveBreakdown,
  getDeltaAmountBaseUnsigned,
  getPriceFromSqrtPrice,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { portageCurve } from "@portage/dbc";

export interface CurvePoint {
  supply: number;
  priceUsd: number;
}

export interface FeeSchedulePoint {
  seconds: number;
  bps: number;
}

export interface LaunchPreview {
  points: CurvePoint[];
  fees: FeeSchedulePoint[];
  totalSupply: number;
}

const BASE_DECIMALS = 6 as TokenDecimal; // fixed by portageCurve's token.tokenBaseDecimal
export const LAUNCH_TOTAL_SUPPLY = 1_000_000_000;

function toBN(value: unknown): BN {
  if (BN.isBN(value)) return value;
  return new BN(String(value));
}

export interface LaunchInputs {
  quoteDecimals: number;
  quoteUsd: number;
  startMarketCapUsd: number;
  graduateMarketCapUsd: number;
}

const SUPPORTED_QUOTE_DECIMALS = new Set([6, 7, 8, 9]);

/**
 * Builds the real portageCurve() config for the given inputs and derives a
 * price-vs-supply series plus the fee-scheduler-vs-time series from it, using
 * the same SDK math the on-chain program evaluates. Nothing here is invented:
 * every point comes from buildCurveWithMarketCap's own output.
 */
export function buildLaunchPreview(inputs: LaunchInputs): LaunchPreview {
  if (!SUPPORTED_QUOTE_DECIMALS.has(inputs.quoteDecimals)) {
    throw new Error(`unsupported quote decimals: ${inputs.quoteDecimals}`);
  }
  if (inputs.quoteUsd <= 0) throw new Error("quote mark price must be positive");
  if (inputs.startMarketCapUsd <= 0) throw new Error("starting market cap must be positive");
  if (inputs.graduateMarketCapUsd <= inputs.startMarketCapUsd) {
    throw new Error("graduation market cap must exceed the starting market cap");
  }

  const config = portageCurve({
    quoteMint: PublicKey.default,
    quoteDecimals: inputs.quoteDecimals as TokenDecimal,
    quoteUsd: inputs.quoteUsd,
    startMarketCapUsd: inputs.startMarketCapUsd,
    graduateMarketCapUsd: inputs.graduateMarketCapUsd,
  });

  // The curve array's last segment extends to MAX_SQRT_PRICE as a theoretical
  // ceiling; the pool actually migrates once migrationQuoteThreshold is raised,
  // at getCurveBreakdown's finalSqrtPrice. Clip the plotted curve there.
  const breakdown = getCurveBreakdown(toBN(config.migrationQuoteThreshold), toBN(config.sqrtStartPrice), config.curve);
  const graduationSqrt = toBN(breakdown.finalSqrtPrice);

  // Sample inside each segment (constant liquidity, so price-vs-supply is a
  // real hyperbola there) instead of only plotting segment endpoints, or a
  // 1-2 segment curve renders as a misleading straight line.
  const STEPS_PER_SEGMENT = 24;
  const priceUsdAt = (sqrtPrice: BN) =>
    getPriceFromSqrtPrice(sqrtPrice, BASE_DECIMALS, inputs.quoteDecimals as TokenDecimal).toNumber() * inputs.quoteUsd;

  const points: CurvePoint[] = [];
  let segmentStartSqrt = toBN(config.sqrtStartPrice);
  let cumulativeBase = new BN(0);
  points.push({ supply: 0, priceUsd: priceUsdAt(segmentStartSqrt) });
  segmentLoop: for (const seg of config.curve) {
    const segSqrt = toBN(seg.sqrtPrice);
    const liquidity = toBN(seg.liquidity);
    const segmentEndSqrt = segSqrt.gt(graduationSqrt) ? graduationSqrt : segSqrt;
    const span = segmentEndSqrt.sub(segmentStartSqrt);
    let runningSqrt = segmentStartSqrt;
    for (let step = 1; step <= STEPS_PER_SEGMENT; step += 1) {
      const stepSqrt = step === STEPS_PER_SEGMENT ? segmentEndSqrt : segmentStartSqrt.add(span.muln(step).divn(STEPS_PER_SEGMENT));
      const deltaBase = getDeltaAmountBaseUnsigned(runningSqrt, stepSqrt, liquidity, Rounding.Down);
      cumulativeBase = cumulativeBase.add(deltaBase);
      points.push({ supply: Number(cumulativeBase.toString()) / 10 ** BASE_DECIMALS, priceUsd: priceUsdAt(stepSqrt) });
      runningSqrt = stepSqrt;
    }
    if (segmentEndSqrt.eq(graduationSqrt)) break segmentLoop;
    segmentStartSqrt = segSqrt;
  }

  const baseFee = config.poolFees.baseFee;
  const numberOfPeriod = Number(baseFee.firstFactor);
  const periodFrequency = Number(toBN(baseFee.secondFactor).toString());
  const cliffFeeNumerator = toBN(baseFee.cliffFeeNumerator);
  const reductionFactor = toBN(baseFee.thirdFactor);
  const mode = Number(baseFee.baseFeeMode) as BaseFeeMode;
  const fees: FeeSchedulePoint[] = [];
  for (let period = 0; period <= numberOfPeriod; period += 1) {
    const numerator = getBaseFeeNumeratorByPeriod(cliffFeeNumerator, numberOfPeriod, new BN(period), reductionFactor, mode);
    fees.push({ seconds: period * periodFrequency, bps: feeNumeratorToBps(numerator) });
  }

  return { points, fees, totalSupply: LAUNCH_TOTAL_SUPPLY };
}
