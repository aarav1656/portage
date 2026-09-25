import Link from "next/link";
import { PORTAGE_PROGRAM_ID } from "@portage/vault";
import { fetchMarketSnapshot, type MarketSnapshot } from "@/lib/market";
import { fetchTMarketSnapshot, type TMarketSnapshot } from "@/lib/tmarket";
import { fetchVaultStatus, type VaultStatus } from "@/lib/vaults";
import { TESSERA_TOKENS, isTesseraKey, type TesseraKey } from "@/lib/tessera";
import { formatBps, formatUsd } from "@/lib/format";
import { AddressLink } from "@/components/address-link";
import { Stamp } from "@/components/stamp";
import { StatTile, StatTileSkeleton } from "@/components/stat-tile";
import { PageHeader } from "@/components/page-header";
import { WrapPanel } from "@/components/wrap-panel";

function vaultStamp(v: VaultStatus | null) {
  if (v === null) return <Stamp variant="pending">Unavailable</Stamp>;
  if (v.state === "not-initialised") return <Stamp variant="pending">Not initialised</Stamp>;
  if (v.state === "error") return <Stamp variant="rejected">Read failed</Stamp>;
  return <Stamp variant={v.invariantHolds ? "cleared" : "rejected"}>{v.invariantHolds ? "Cleared" : "Broken"}</Stamp>;
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token: tokenParam } = await searchParams;
  const initialToken: TesseraKey = isTesseraKey(tokenParam ?? "") ? (tokenParam as TesseraKey) : "Kalshi";

  let market: MarketSnapshot | null = null;
  let marketError: string | null = null;
  try {
    market = await fetchMarketSnapshot();
  } catch (err) {
    marketError = err instanceof Error ? err.message : "market data unavailable";
  }

  let tmarket: TMarketSnapshot | null = null;
  let tmarketError: string | null = null;
  try {
    tmarket = await fetchTMarketSnapshot();
  } catch (err) {
    tmarketError = err instanceof Error ? err.message : "dex market data unavailable";
  }

  const [vaultKalshi, vaultOpenAI] = await Promise.all([fetchVaultStatus("Kalshi"), fetchVaultStatus("OpenAI")]);
  const vaults: Record<TesseraKey, VaultStatus> = { Kalshi: vaultKalshi, OpenAI: vaultOpenAI };

  return (
    <div className="space-y-14 py-10">
      <PageHeader
        no="01"
        eyebrow="Declaration of cargo"
        title="Cargo that cannot clear customs on its own"
        lede={
          <>
            tKalshi and tOpenAI are Token-2022 with a live transfer fee, and Meteora&apos;s Dynamic Bonding Curve program
            refuses any quote mint that charges one. Portage holds the Tessera token in a bonded vault and issues a plain
            SPL receipt, wtKALSHI, 1:1, so a launch can finally be quoted in it.
          </>
        }
        meta={[
          { label: "Network", value: "Mainnet-beta" },
          { label: "Program", value: <AddressLink value={PORTAGE_PROGRAM_ID.toBase58()} /> },
        ]}
      />

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]" aria-label="The rejection, the fix, and the live numbers">
        <div className="panel fade-in flex flex-col p-5 sm:p-6">
          <h2 className="text-lg">Why Meteora rejects the raw token</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Stamp variant="rejected">Rejected</Stamp>
            <code className="mono rounded bg-[var(--paper-3)] px-2 py-1 text-sm text-[var(--ink)]">
              QuoteMintHasNonZeroTransferFee
            </code>
          </div>
          <p className="mt-3 text-sm text-[var(--ink-2)]">
            Thrown by <code className="mono">dynamic-bonding-curve/utils/token.rs</code> the moment a quote mint carries a
            Token-2022 transfer fee extension &mdash; both tKalshi and tOpenAI carry one right now, read live below. The
            wrapped receipt is a plain legacy SPL mint with no extensions, so the same check clears it.
          </p>
          <div className="mt-auto flex flex-wrap gap-3 pt-5">
            <a href="#wrap" className="btn btn-primary">
              Wrap now
            </a>
            <Link href="/proof" className="btn btn-outline">
              Watch the rejection run live
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 content-start" aria-label="Live stat strip">
          {marketError !== null ? (
            <div className="col-span-2 panel p-4">
              <p className="text-sm text-[var(--rejected)]">Could not read live fees: {marketError}</p>
            </div>
          ) : market === null ? (
            <>
              <StatTileSkeleton />
              <StatTileSkeleton />
            </>
          ) : (
            Object.values(TESSERA_TOKENS).map((t) => {
              const row = market![t.code as "tKalshi" | "tOpenAI"];
              return (
                <StatTile
                  key={t.code}
                  label={`${t.label} fee`}
                  value={formatBps(row.transferFeeBps)}
                  sub="Live transfer fee, this epoch"
                  tone="rejected"
                />
              );
            })
          )}

          {tmarketError !== null ? (
            <div className="col-span-2 panel p-4">
              <p className="text-sm text-[var(--rejected)]">Could not read live DEX prices: {tmarketError}</p>
            </div>
          ) : tmarket === null ? (
            <>
              <StatTileSkeleton />
              <StatTileSkeleton />
            </>
          ) : (
            Object.values(TESSERA_TOKENS).map((t) => {
              const row = tmarket![t.code as "tKalshi" | "tOpenAI"];
              const isPremium = row.premiumPct >= 0;
              return (
                <StatTile
                  key={t.code}
                  label={`${t.label} vs mark`}
                  value={`${isPremium ? "+" : ""}${row.premiumPct.toFixed(2)}%`}
                  sub={`DEX ${formatUsd(row.dexPrice)} · mark ${formatUsd(row.markPrice)}`}
                  tone={isPremium ? "rejected" : "accent"}
                />
              );
            })
          )}

          {(Object.keys(TESSERA_TOKENS) as TesseraKey[]).map((key) => (
            <div key={key} className="panel min-w-0 p-4">
              <p className="mono truncate text-[0.6875rem] uppercase tracking-widest text-[var(--ink-3)]">
                {TESSERA_TOKENS[key].label} vault
              </p>
              <div className="mt-2">{vaultStamp(vaults[key])}</div>
            </div>
          ))}
        </div>
      </section>

      <div id="wrap">
        <WrapPanel market={market} marketError={marketError} initialToken={initialToken} />
      </div>
    </div>
  );
}
