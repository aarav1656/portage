import { TESSERA_API } from "@portage/dbc";
import { readLiveTransferFee } from "@/lib/fee";
import { connection } from "@/lib/rpc";
import { TESSERA_TOKENS } from "@/lib/tessera";
import { getCachedPrice, updateCacheEntry } from "@/lib/tessera-cache";

export interface MarketToken {
  markPrice: number;
  transferFeeBps: number;
  maxFeeRaw: string;
  decimals: number;
  mint: string;
  stale?: boolean;
  asOf?: string; // ISO timestamp of when mark price was fetched
}

export type MarketSnapshot = Record<"tKalshi" | "tOpenAI", MarketToken>;

interface TesseraRow {
  code: string;
  markPrice: number;
}

/** Live mark price (Tessera) + live on-chain transfer fee for every wrapped token. On Tessera failure, uses cached price. */
export async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  const conn = connection();
  const entries = await Promise.all(
    Object.values(TESSERA_TOKENS).map(async (t) => {
      let markPrice: number | null = null;
      let fetchedAt: string | null = null;
      let stale = false;

      try {
        const res = await fetch(TESSERA_API, { cache: "no-store" });
        if (!res.ok) throw new Error(`Tessera API returned ${res.status}`);
        const rows = (await res.json()) as TesseraRow[];
        const row = rows.find((r) => r.code === t.code);
        if (!row) throw new Error(`Tessera API has no entry for ${t.code}`);
        markPrice = row.markPrice;
        fetchedAt = new Date().toISOString();
        await updateCacheEntry({ code: t.code, markPrice, fetchedAt });
      } catch (err) {
        const cached = await getCachedPrice(t.code);
        if (cached) {
          markPrice = cached.markPrice;
          fetchedAt = cached.fetchedAt;
          stale = true;
        } else {
          throw err;
        }
      }

      const fee = await readLiveTransferFee(conn, t.mint);
      const token: MarketToken = {
        markPrice,
        transferFeeBps: fee.bps,
        maxFeeRaw: fee.maxFeeRaw,
        decimals: fee.decimals,
        mint: t.mint.toBase58(),
      };
      if (stale) {
        token.stale = true;
        token.asOf = fetchedAt || undefined;
      }
      return [t.code, token] as const;
    }),
  );
  return Object.fromEntries(entries) as MarketSnapshot;
}
