"use client";
import { useMemo, useState } from "react";
import { TESSERA_TOKENS, type TesseraKey } from "@/lib/tessera";
import { buildLaunchPreview, LAUNCH_TOTAL_SUPPLY } from "@/lib/curve";
import { formatUsd } from "@/lib/format";
import { CurveChart } from "@/components/curve-chart";
import { FeeSchedule } from "@/components/fee-schedule";
import { LaunchSimPanel } from "@/components/launch-sim-panel";

export interface QuoteInfo {
  markPrice: number;
  decimals: number;
}

export function LaunchConfigurator({
  quotes,
  quotesError,
}: {
  quotes: Partial<Record<TesseraKey, QuoteInfo>>;
  quotesError: string | null;
}) {
  const [name, setName] = useState("Portage Launch");
  const [symbol, setSymbol] = useState("PTG");
  const [quoteKey, setQuoteKey] = useState<TesseraKey>("Kalshi");
  const [startUsd, setStartUsd] = useState("10000");
  const [graduateUsd, setGraduateUsd] = useState("100000");

  const quote = quotes[quoteKey] ?? null;
  const wrappedSymbol = `wt${TESSERA_TOKENS[quoteKey].label.replace("T-", "").toUpperCase()}`;

  const result = useMemo(() => {
    if (quote === null) return { preview: null, error: quotesError ?? "quote mark price unavailable" };
    const start = Number(startUsd);
    const graduate = Number(graduateUsd);
    if (!Number.isFinite(start) || !Number.isFinite(graduate)) {
      return { preview: null, error: "market caps must be numbers" };
    }
    try {
      const preview = buildLaunchPreview({
        quoteDecimals: quote.decimals,
        quoteUsd: quote.markPrice,
        startMarketCapUsd: start,
        graduateMarketCapUsd: graduate,
      });
      return { preview, error: null };
    } catch (err) {
      return { preview: null, error: err instanceof Error ? err.message : "could not build the curve" };
    }
  }, [quote, startUsd, graduateUsd, quotesError]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
      <form className="panel fade-in space-y-4 p-4 sm:p-5" onSubmit={(e) => e.preventDefault()}>
        <h2 className="text-lg">Configure the launch</h2>

        <label className="block">
          <span className="text-sm text-[var(--ink-2)]">Token name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full px-3 py-2" maxLength={32} />
        </label>

        <label className="block">
          <span className="text-sm text-[var(--ink-2)]">Symbol</span>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="mt-1 w-full px-3 py-2"
            maxLength={10}
          />
        </label>

        <label className="block">
          <span className="text-sm text-[var(--ink-2)]">Supply</span>
          <input type="text" value={LAUNCH_TOTAL_SUPPLY.toLocaleString("en-US")} disabled className="mt-1 w-full px-3 py-2 opacity-70" />
          <span className="mt-1 block text-xs text-[var(--ink-3)]">Fixed by the curve, not configurable per launch.</span>
        </label>

        <div>
          <span className="text-sm text-[var(--ink-2)]">Quoted in</span>
          <div className="mt-1 flex gap-1" role="group" aria-label="Quote token">
            {(Object.keys(TESSERA_TOKENS) as TesseraKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setQuoteKey(key)}
                className={`btn px-3 py-1.5 text-xs ${quoteKey === key ? "btn-primary" : "btn-outline"}`}
              >
                wt{TESSERA_TOKENS[key].label.replace("T-", "").toUpperCase()}
              </button>
            ))}
          </div>
          {quote !== null && (
            <p className="mt-1 text-xs text-[var(--ink-3)]">
              Live mark: {formatUsd(quote.markPrice)} / {TESSERA_TOKENS[quoteKey].label}
            </p>
          )}
        </div>

        <label className="block">
          <span className="text-sm text-[var(--ink-2)]">Starting market cap (USD)</span>
          <input type="text" inputMode="numeric" value={startUsd} onChange={(e) => setStartUsd(e.target.value)} className="mt-1 w-full px-3 py-2" />
        </label>

        <label className="block">
          <span className="text-sm text-[var(--ink-2)]">Graduation threshold (USD)</span>
          <input type="text" inputMode="numeric" value={graduateUsd} onChange={(e) => setGraduateUsd(e.target.value)} className="mt-1 w-full px-3 py-2" />
        </label>
      </form>

      <div className="space-y-6">
        <section className="panel fade-in p-4 sm:p-5" aria-label="Bonding curve">
          <h2 className="text-lg">
            {name || "Untitled"} ({symbol || "?"}) curve, quoted in {wrappedSymbol}
          </h2>
          {result.preview === null ? (
            <p className="mt-3 text-sm text-[var(--rejected)]">{result.error}</p>
          ) : (
            <div className="mt-3">
              <CurveChart points={result.preview.points} graduateUsd={Number(graduateUsd)} />
            </div>
          )}
        </section>

        <section className="panel fade-in p-4 sm:p-5" aria-label="Fee schedule">
          <h2 className="text-lg">Anti-snipe fee schedule</h2>
          <p className="mt-1 text-sm text-[var(--ink-2)]">
            The base fee decays from its opening rate to its floor over the first five minutes, computed from the same
            fee-scheduler config the pool would deploy with.
          </p>
          {result.preview === null ? (
            <p className="mt-3 text-sm text-[var(--rejected)]">Unavailable until the curve builds.</p>
          ) : (
            <div className="mt-3">
              <FeeSchedule fees={result.preview.fees} />
            </div>
          )}
        </section>

        <LaunchSimPanel
          name={name}
          symbol={symbol}
          supply={LAUNCH_TOTAL_SUPPLY}
          startMcapUsd={Number(startUsd)}
        />
      </div>
    </div>
  );
}
