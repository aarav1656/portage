import { fetchMarketSnapshot } from "@/lib/market";
import { TESSERA_TOKENS } from "@/lib/tessera";
import { formatBps } from "@/lib/format";
import { AddressLink } from "@/components/address-link";
import { Stamp } from "@/components/stamp";
import { WrapPanel } from "@/components/wrap-panel";

export default async function HomePage() {
  let market = null as Awaited<ReturnType<typeof fetchMarketSnapshot>> | null;
  let marketError: string | null = null;
  try {
    market = await fetchMarketSnapshot();
  } catch (err) {
    marketError = err instanceof Error ? err.message : "market data unavailable";
  }

  return (
    <div className="space-y-10 py-10">
      <section className="fade-in">
        <p className="mono text-xs uppercase tracking-widest text-[var(--ink-3)]">Manifest · declaration of cargo</p>
        <h1 className="mt-2 text-4xl leading-tight sm:text-5xl">Cargo that cannot clear customs on its own</h1>
        <p className="mt-4 max-w-2xl text-base text-[var(--ink-2)]">
          tKalshi and tOpenAI are Token-2022 with a live transfer fee, and Meteora&apos;s Dynamic Bonding Curve program
          refuses any quote mint that charges one. Portage holds the Tessera token in a bonded vault and issues a plain
          SPL receipt, wtKALSHI, 1:1, so a launch can finally be quoted in it.
        </p>
      </section>

      <section className="panel fade-in p-4 sm:p-5" aria-label="DBC rejection">
        <h2 className="text-lg">Why Meteora rejects the raw token</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Stamp variant="rejected">Rejected</Stamp>
          <code className="mono rounded bg-[var(--paper-3)] px-2 py-1 text-sm text-[var(--ink)]">
            QuoteMintHasNonZeroTransferFee
          </code>
        </div>
        <p className="mt-3 text-sm text-[var(--ink-2)]">
          Thrown by <code className="mono">dynamic-bonding-curve/utils/token.rs</code> the moment a quote mint carries a
          Token-2022 transfer fee extension. The live fee, read from each mint on chain right now:
        </p>
        {marketError !== null ? (
          <p className="mt-3 text-sm text-[var(--rejected)]">Could not read live fees: {marketError}</p>
        ) : market === null ? (
          <div className="mt-3 space-y-2">
            <div className="h-6 w-full skeleton" />
            <div className="h-6 w-full skeleton" />
          </div>
        ) : (
          <dl className="mt-3">
            {Object.entries(TESSERA_TOKENS).map(([key, t]) => {
              const row = market[t.code as "tKalshi" | "tOpenAI"];
              return (
                <div key={key} className="ledger-row">
                  <dt className="text-sm text-[var(--ink-2)]">
                    {t.label} <AddressLink value={t.mint.toBase58()} />
                  </dt>
                  <dd className="mono text-sm text-[var(--ink)]">{formatBps(row.transferFeeBps)} transfer fee</dd>
                </div>
              );
            })}
          </dl>
        )}
      </section>

      <WrapPanel market={market} marketError={marketError} />
    </div>
  );
}
