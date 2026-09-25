import { LaunchConfigurator, type QuoteInfo } from "@/components/launch-configurator";
import { PageHeader } from "@/components/page-header";
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
      <PageHeader
        no="04"
        eyebrow="Launch manifest"
        title="Configure a launch quoted in wtKALSHI"
        lede={
          <>
            Set a name, symbol, and the two market caps that bound the bonding curve. The curve and its fee schedule
            below come straight out of <code className="mono">packages/dbc</code>&apos;s{" "}
            <code className="mono">portageCurve</code>, priced against the live Tessera mark.
          </>
        }
      />

      <LaunchConfigurator quotes={quotes} quotesError={quotesError} />
    </div>
  );
}
