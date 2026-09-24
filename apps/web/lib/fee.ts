import type { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getEpochFee, getMint, getTransferFeeConfig } from "@solana/spl-token";

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
