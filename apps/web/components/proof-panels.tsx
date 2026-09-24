"use client";
import { useEffect, useState } from "react";
import { AddressLink } from "@/components/address-link";
import { Stamp } from "@/components/stamp";

export interface SimResult {
  quote: "raw" | "plain";
  err: unknown;
  logs: string[];
  unitsConsumed: number | null;
  simulatedAt: string;
}

const RAW_MINT = "TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ";
const PLAIN_MINT = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn";

function failingLine(logs: string[]): string | null {
  const hit = logs.find((l) => /QuoteMintHasNonZeroTransferFee|6081|0x17[cC]1/.test(l));
  if (hit) return hit;
  return logs.find((l) => /failed|Error/i.test(l)) ?? null;
}

function ResultPanel({
  title,
  mint,
  mintLabel,
  result,
  loading,
  error,
}: {
  title: string;
  mint: string;
  mintLabel: string;
  result: SimResult | null;
  loading: boolean;
  error: string | null;
}) {
  const failed = result !== null && result.err !== null;
  return (
    <section aria-label={title} className="panel fade-in p-4 sm:p-5" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg">{title}</h2>
        {loading ? (
          <span className="mono text-xs uppercase tracking-widest text-[var(--ink-3)]">Simulating</span>
        ) : error !== null ? (
          <Stamp variant="pending">Error</Stamp>
        ) : result !== null ? (
          failed ? (
            <Stamp variant="rejected">Rejected</Stamp>
          ) : (
            <Stamp variant="cleared">Cleared</Stamp>
          )
        ) : (
          <Stamp variant="pending">Empty</Stamp>
        )}
      </div>
      <dl className="mt-3">
        <div className="ledger-row">
          <dt className="text-sm text-[var(--ink-2)]">Quote mint</dt>
          <dd className="text-sm">
            <AddressLink value={mint} />
          </dd>
        </div>
        <div className="ledger-row">
          <dt className="text-sm text-[var(--ink-2)]">Mint kind</dt>
          <dd className="mono text-sm text-[var(--ink)]">{mintLabel}</dd>
        </div>
        {loading && (
          <div className="mt-3 space-y-2" aria-label={`Loading ${title}`}>
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
          <p className="mt-3 text-sm text-[var(--ink-3)]">No simulation returned for this quote yet.</p>
        )}
        {!loading && result !== null && (
          <>
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
              <dt className="text-sm text-[var(--ink-2)]">Simulated at</dt>
              <dd className="mono text-sm text-[var(--ink)]">{result.simulatedAt}</dd>
            </div>
          </>
        )}
      </dl>
      {!loading && result !== null && (
        <div className="mt-3">
          <h3 className="mono text-xs uppercase tracking-widest text-[var(--ink-3)]">Program logs</h3>
          <pre className="mono mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-[var(--paper-3)] p-3 text-xs leading-relaxed text-[var(--ink)]">
            {result.logs.join("\n")}
          </pre>
        </div>
      )}
    </section>
  );
}

export function ProofPanels(): React.ReactNode {
  const [raw, setRaw] = useState<SimResult | null>(null);
  const [plain, setPlain] = useState<SimResult | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [plainError, setPlainError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setRawError(null);
      setPlainError(null);
      try {
        const [rawRes, plainRes] = await Promise.all([
          fetch("/api/simulate?quote=raw", { cache: "no-store" }),
          fetch("/api/simulate?quote=plain", { cache: "no-store" }),
        ]);
        const rawJson = (await rawRes.json()) as SimResult & { error?: string };
        const plainJson = (await plainRes.json()) as SimResult & { error?: string };
        if (cancelled) return;
        if (!rawRes.ok || rawJson.error) setRawError(rawJson.error ?? `request failed with ${rawRes.status}`);
        else setRaw(rawJson);
        if (!plainRes.ok || plainJson.error) setPlainError(plainJson.error ?? `request failed with ${plainRes.status}`);
        else setPlain(plainJson);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "network request failed";
        setRawError(message);
        setPlainError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const line = raw !== null ? failingLine(raw.logs) : null;

  return (
    <div aria-live="polite">
      <div className="grid grid-cols-1 gap-6 min-w-0 md:grid-cols-2">
        <ResultPanel
          title="Raw tKalshi quote"
          mint={RAW_MINT}
          mintLabel="Token-2022, live transfer fee"
          result={raw}
          loading={loading}
          error={rawError}
        />
        <ResultPanel
          title="Plain quote"
          mint={PLAIN_MINT}
          mintLabel="Legacy SPL, no extensions"
          result={plain}
          loading={loading}
          error={plainError}
        />
      </div>
      <section aria-label="Failing program log line" className="panel fade-in mt-6 p-4 sm:p-5">
        <h2 className="text-lg">The failing program log line</h2>
        {loading ? (
          <div className="mt-3 h-6 w-full skeleton" aria-label="Loading failing log line" />
        ) : line !== null ? (
          <code className="mono mt-3 block break-all rounded bg-[var(--paper-3)] p-3 text-sm text-[var(--rejected)]">
            {line}
          </code>
        ) : (
          <p className="mt-3 text-sm text-[var(--ink-3)]">No rejection line in this run.</p>
        )}
        <p className="mt-3 text-sm text-[var(--ink-2)]">
          Full rejection name: <code className="mono text-[var(--ink)]">QuoteMintHasNonZeroTransferFee</code> (custom
          error 6081). It is thrown before any pool state is written, so the raw quote never clears customs.
        </p>
      </section>
    </div>
  );
}
