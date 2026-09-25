"use client";
import { useState } from "react";
import { Stamp } from "@/components/stamp";
import { formatUsd } from "@/lib/format";

export interface LaunchSimResult {
  err: unknown;
  logs: string[];
  unitsConsumed: number | null;
  startPriceUsd: number;
  anchor: { tesseraMarkPrice: number; fetchedAt: string; stale: boolean };
  simulatedAt: string;
}

const SHOWN_LOGS = 8;

export function LaunchSimPanel({
  name,
  symbol,
  supply,
  startMcapUsd,
}: {
  name: string;
  symbol: string;
  supply: number;
  startMcapUsd: number;
}) {
  const [result, setResult] = useState<LaunchSimResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputsValid =
    name.trim().length > 0 && symbol.trim().length > 0 && Number.isFinite(startMcapUsd) && startMcapUsd > 0;

  async function simulate() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        name: name.trim() || "Portage Launch",
        symbol: (symbol.trim() || "PTG").toUpperCase(),
        supply: String(supply),
        startMcapUsd: String(startMcapUsd),
      });
      const res = await fetch(`/api/launch-sim?${qs.toString()}`, { cache: "no-store" });
      const json = (await res.json()) as LaunchSimResult & { error?: string };
      if (!res.ok || json.error) {
        setResult(null);
        setError(json.error ?? `request failed with ${res.status}`);
        return;
      }
      setResult(json);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "network request failed");
    } finally {
      setLoading(false);
    }
  }

  const passed = result !== null && result.err === null;

  return (
    <section aria-label="Mainnet simulation" aria-busy={loading} className="panel fade-in min-w-0 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg">Mainnet simulation</h2>
        {loading ? (
          <span className="mono text-xs uppercase tracking-widest text-[var(--ink-3)]">Simulating</span>
        ) : error !== null ? (
          <Stamp variant="rejected">Error</Stamp>
        ) : result !== null ? (
          passed ? (
            <Stamp variant="cleared">Pass</Stamp>
          ) : (
            <Stamp variant="rejected">Fail</Stamp>
          )
        ) : (
          <Stamp variant="pending">Not run</Stamp>
        )}
      </div>
      <p className="mt-1 text-sm text-[var(--ink-2)]">
        Builds the real createConfig plus pool transaction and simulates it on mainnet. Nothing is signed or sent.
      </p>

      <div className="mt-3">
        <button
          type="button"
          onClick={simulate}
          disabled={loading || !inputsValid}
          className="btn btn-primary"
          aria-label="Simulate on mainnet"
        >
          {loading ? "Simulating" : "Simulate on mainnet"}
        </button>
        {!inputsValid && (
          <p className="mt-2 text-sm text-[var(--ink-3)]">Enter a name, symbol and starting market cap to simulate.</p>
        )}
      </div>

      <div aria-live="polite">
        {loading && (
          <div className="mt-3 space-y-2" aria-label="Loading simulation result">
            <div className="h-5 w-full skeleton" />
            <div className="h-5 w-5/6 skeleton" />
            <div className="h-24 w-full skeleton" />
          </div>
        )}

        {error !== null && !loading && (
          <p role="alert" className="mt-3 text-sm text-[var(--rejected)]">
            Simulation request failed: {error}
          </p>
        )}

        {!loading && error === null && result === null && (
          <p className="mt-3 text-sm text-[var(--ink-3)]">No simulation run yet for these launch values.</p>
        )}

        {!loading && result !== null && (
          <>
            <dl className="mt-3">
              <div className="ledger-row">
                <dt className="text-sm text-[var(--ink-2)]">Result</dt>
                <dd className="mono break-all text-right text-sm text-[var(--ink)]">
                  {result.err === null ? "err null" : `err ${JSON.stringify(result.err)}`}
                </dd>
              </div>
              <div className="ledger-row">
                <dt className="text-sm text-[var(--ink-2)]">Compute units</dt>
                <dd className="mono text-sm text-[var(--ink)]">
                  {result.unitsConsumed === null ? "unknown" : result.unitsConsumed.toLocaleString("en-US")}
                </dd>
              </div>
              <div className="ledger-row">
                <dt className="text-sm text-[var(--ink-2)]">Anchored start price</dt>
                <dd className="mono text-right text-sm text-[var(--ink)]">
                  {formatUsd(result.startPriceUsd)} at {formatUsd(result.anchor.tesseraMarkPrice)}
                  {result.anchor.stale ? " (stale)" : ""}
                </dd>
              </div>
              <div className="ledger-row">
                <dt className="text-sm text-[var(--ink-2)]">Simulated at</dt>
                <dd className="mono text-sm text-[var(--ink)]">{result.simulatedAt}</dd>
              </div>
            </dl>
            <div className="mt-3">
              <h3 className="mono text-xs uppercase tracking-widest text-[var(--ink-3)]">Program logs</h3>
              {result.logs.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--ink-3)]">The simulation returned no log lines.</p>
              ) : (
                <pre className="mono mt-2 max-h-64 min-w-0 overflow-auto whitespace-pre-wrap break-all rounded bg-[var(--paper-3)] p-3 text-xs leading-relaxed text-[var(--ink)]">
                  {result.logs.slice(0, SHOWN_LOGS).join("\n")}
                </pre>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
