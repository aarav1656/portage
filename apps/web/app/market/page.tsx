import Link from "next/link";
import { fetchTMarketSnapshot, type TMarketSnapshot } from "@/lib/tmarket";
import { TESSERA_TOKENS, type TesseraKey } from "@/lib/tessera";
import { AddressLink } from "@/components/address-link";
import { PageHeader } from "@/components/page-header";
import { formatUsd } from "@/lib/format";

// Reads live Tessera, Jupiter, and DexScreener prices on every request; must never be statically cached.
export const dynamic = "force-dynamic";

export default async function MarketPage() {
  let market: TMarketSnapshot | null = null;
  let marketError: string | null = null;
  try {
    market = await fetchTMarketSnapshot();
  } catch (err) {
    marketError = err instanceof Error ? err.message : "tmarket data unavailable";
  }

  const keys = Object.keys(TESSERA_TOKENS) as TesseraKey[];

  return (
    <div className="space-y-10 py-10">
      <PageHeader
        no="03"
        eyebrow="Mark vs DEX"
        title="Where the DEX disagrees with Tessera"
        lede={
          <>
            The Tessera mark is the pre-IPO desk price for the raw token. The DEX price is what wtKALSHI or wtOpenAI
            actually clears at on Jupiter once it is wrapped and pooled. The gap between them is the premium or discount
            a wrap-and-launch can close.
          </>
        }
      />

      {marketError !== null && (
        <p className="text-sm text-[var(--rejected)]">Could not read live market data: {marketError}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {keys.map((key, i) => {
          const t = TESSERA_TOKENS[key];
          const row = market?.[t.code as "tKalshi" | "tOpenAI"] ?? null;
          const isPremium = row !== null && row.premiumPct >= 0;
          return (
            <section
              key={key}
              className="panel fade-in flex flex-col p-4 sm:p-5"
              style={{ animationDelay: `${i * 60}ms` }}
              aria-label={`${t.label} market`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg">{t.label}</h2>
                {row !== null && (
                  <span className={`mono text-sm ${isPremium ? "text-[var(--rejected)]" : "text-[var(--accent)]"}`}>
                    {isPremium ? "Premium" : "Discount"} {Math.abs(row.premiumPct).toFixed(2)}%
                  </span>
                )}
              </div>

              {marketError !== null ? null : row === null ? (
                <div className="mt-3 space-y-2" aria-label="Loading market data">
                  <div className="h-6 w-full skeleton" />
                  <div className="h-6 w-full skeleton" />
                  <div className="h-6 w-full skeleton" />
                </div>
              ) : (
                <dl className="mt-3">
                  <div className="ledger-row">
                    <dt className="text-sm text-[var(--ink-2)]">Tessera mark{row.stale ? " (stale)" : ""}</dt>
                    <dd className="mono text-sm text-[var(--ink)]">{formatUsd(row.markPrice)}</dd>
                  </div>
                  <div className="ledger-row">
                    <dt className="text-sm text-[var(--ink-2)]">Jupiter DEX price</dt>
                    <dd className="mono text-sm text-[var(--ink)]">{formatUsd(row.dexPrice)}</dd>
                  </div>
                  <div className="ledger-row">
                    <dt className="text-sm text-[var(--ink-2)]">Main pool</dt>
                    <dd>
                      <AddressLink value={row.pool} />
                    </dd>
                  </div>
                  <div className="ledger-row">
                    <dt className="text-sm text-[var(--ink-2)]">Liquidity</dt>
                    <dd className="mono text-sm text-[var(--ink)]">{formatUsd(row.liquidityUsd)}</dd>
                  </div>
                  <div className="ledger-row">
                    <dt className="text-sm text-[var(--ink-2)]">24h volume</dt>
                    <dd className="mono text-sm text-[var(--ink)]">{formatUsd(row.volume24hUsd)}</dd>
                  </div>
                </dl>
              )}

              <div className="mt-4 flex flex-wrap gap-2 pt-1">
                <Link href={`/?token=${key}#wrap`} className="btn btn-primary px-3 py-1.5 text-xs">
                  Wrap for a DBC launch
                </Link>
                <Link href="/launch" className="btn btn-outline px-3 py-1.5 text-xs">
                  Launch on DBC
                </Link>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
