import { TESSERA_API } from "@portage/dbc";
import { readLiveTransferFee } from "@/lib/fee";
import { connection } from "@/lib/rpc";
import { TESSERA_TOKENS } from "@/lib/tessera";

export interface MarketToken {
  markPrice: number;
  transferFeeBps: number;
  maxFeeRaw: string;
  decimals: number;
  mint: string;
}

export type MarketSnapshot = Record<"tKalshi" | "tOpenAI", MarketToken>;

interface TesseraRow {
  code: string;
  markPrice: number;
}

/** Live mark price (Tessera) + live on-chain transfer fee for every wrapped token. No caching. */
export async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  const res = await fetch(TESSERA_API, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Tessera API returned ${res.status}`);
  }
  const rows = (await res.json()) as TesseraRow[];
  const conn = connection();
  const entries = await Promise.all(
    Object.values(TESSERA_TOKENS).map(async (t) => {
      const row = rows.find((r) => r.code === t.code);
      if (!row) throw new Error(`Tessera API has no entry for ${t.code}`);
      const fee = await readLiveTransferFee(conn, t.mint);
      const token: MarketToken = {
        markPrice: row.markPrice,
        transferFeeBps: fee.bps,
        maxFeeRaw: fee.maxFeeRaw,
        decimals: fee.decimals,
        mint: t.mint.toBase58(),
      };
      return [t.code, token] as const;
    }),
  );
  return Object.fromEntries(entries) as MarketSnapshot;
}
