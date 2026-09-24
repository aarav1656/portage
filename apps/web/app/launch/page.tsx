import { LaunchConfigurator, type QuoteInfo } from "@/components/launch-configurator";
import { fetchMarketSnapshot } from "@/lib/market";
import type { TesseraKey } from "@/lib/tessera";

export default async function LaunchPage() {
  let quotes: Partial<Record<TesseraKey, QuoteInfo>> = {};
  let quotesError: string | null = null;
  try {
    const snapshot = await fetchMarketSnapshot();
    quotes = {
      Kalshi: { markPrice: snapshot.tKalshi.markPrice, decimals: snapshot.tKalshi.decimals },
      OpenAI: { markPrice: snapshot.tOpenAI.markPrice, decimals: snapshot.tOpenAI.decimals },
    };
  } catch (err) {
    quotesError = err instanceof Error ? err.message : "live mark price unavailable";
  }

  return (
    <div className="space-y-10 py-10">
      <section className="fade-in">
        <p className="mono text-xs uppercase tracking-widest text-[var(--ink-3)]">Launch manifest</p>
        <h1 className="mt-2 text-4xl leading-tight sm:text-5xl">Configure a launch quoted in wtKALSHI</h1>
        <p className="mt-4 max-w-2xl text-base text-[var(--ink-2)]">
          Set a name, symbol, and the two market caps that bound the bonding curve. The curve and its fee schedule below
          come straight out of <code className="mono">packages/dbc</code>&apos;s <code className="mono">portageCurve</code>,
          priced against the live Tessera mark.
        </p>
      </section>

      <LaunchConfigurator quotes={quotes} quotesError={quotesError} />
    </div>
  );
}
