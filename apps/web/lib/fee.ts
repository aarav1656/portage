import type { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, calculateFee, getEpochFee, getMint, getTransferFeeConfig } from "@solana/spl-token";

export interface LiveTransferFee {
  bps: number;
  maxFeeRaw: string;
  decimals: number;
}

/** Reads the Token-2022 transferFeeConfig extension in force for the current epoch. */
export async function readLiveTransferFee(conn: Connection, mint: PublicKey): Promise<LiveTransferFee> {
  const mintInfo = await getMint(conn, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
  const config = getTransferFeeConfig(mintInfo);
  if (config === null) {
    throw new Error(`mint ${mint.toBase58()} has no transferFeeConfig extension`);
  }
  const epochInfo = await conn.getEpochInfo();
  const fee = getEpochFee(config, BigInt(epochInfo.epoch));
  return {
    bps: fee.transferFeeBasisPoints,
    maxFeeRaw: fee.maximumFee.toString(),
    decimals: mintInfo.decimals,
  };
}

/** Headroom below the live-fee quote, in bps of the amount, so a small fee change still lands. */
export const MIN_TOLERANCE_BPS = 10n;

/** Quote for one wrap or unwrap: the fee at the live rate, and the on-chain minimum (min_minted / min_out). */
export function quoteMinimum(raw: bigint, fee: Pick<LiveTransferFee, "bps" | "maxFeeRaw">) {
  const feeRaw = calculateFee(
    { epoch: 0n, maximumFee: BigInt(fee.maxFeeRaw), transferFeeBasisPoints: fee.bps },
    raw,
  );
  const received = raw - feeRaw;
  const slack = (raw * MIN_TOLERANCE_BPS) / 10_000n;
  return { fee: feeRaw, received, min: received > slack ? received - slack : 0n };
}
