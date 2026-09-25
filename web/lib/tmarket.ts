import { fetchMarketSnapshot } from "@/lib/market";
import { TESSERA_TOKENS } from "@/lib/tessera";

export interface TMarketToken {
  markPrice: number;
  stale?: boolean;
  asOf?: string;
  dexPrice: number;
  premiumPct: number;
  pool: string;
  liquidityUsd: number;
  volume24hUsd: number;
}

export type TMarketSnapshot = Record<"tKalshi" | "tOpenAI", TMarketToken>;

interface JupiterPriceRow {
  usdPrice: number;
}

interface DexScreenerPair {
  pairAddress: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
}

/** Mark (Tessera) vs DEX (Jupiter price v3) for every wrapped token, plus the largest-liquidity DexScreener pool. */
export async function fetchTMarketSnapshot(): Promise<TMarketSnapshot> {
  const snapshot = await fetchMarketSnapshot();
  const entries = await Promise.all(
    Object.values(TESSERA_TOKENS).map(async (t) => {
      const mint = t.mint.toBase58();
      const mark = snapshot[t.code as "tKalshi" | "tOpenAI"];

      const priceRes = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mint}`, { cache: "no-store" });
      if (!priceRes.ok) throw new Error(`Jupiter price v3 returned ${priceRes.status} for ${t.code}`);
      const priceJson = (await priceRes.json()) as Record<string, JupiterPriceRow>;
      const dexPrice = priceJson[mint]?.usdPrice;
      if (!(dexPrice > 0)) throw new Error(`Jupiter price v3 has no usdPrice for ${t.code}`);

      const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, { cache: "no-store" });
      if (!dexRes.ok) throw new Error(`DexScreener returned ${dexRes.status} for ${t.code}`);
      const dexJson = (await dexRes.json()) as { pairs?: DexScreenerPair[] };
      const pairs = dexJson.pairs ?? [];
      if (pairs.length === 0) throw new Error(`DexScreener has no pools for ${t.code}`);
      const best = pairs.reduce((a, b) => ((b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a));

      const token: TMarketToken = {
        markPrice: mark.markPrice,
        dexPrice,
        premiumPct: (dexPrice / mark.markPrice - 1) * 100,
        pool: best.pairAddress,
        liquidityUsd: best.liquidity?.usd ?? 0,
        volume24hUsd: best.volume?.h24 ?? 0,
      };
      if (mark.stale) {
        token.stale = true;
        token.asOf = mark.asOf;
      }
      return [t.code, token] as const;
    }),
  );
  return Object.fromEntries(entries) as TMarketSnapshot;
}
