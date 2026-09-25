import type { Metadata } from "next";
import Link from "next/link";
import { AddressLink } from "@/components/address-link";
import { DeckNav } from "@/components/deck-nav";
import { Stamp } from "@/components/stamp";
import { PublicKey } from "@solana/web3.js";
import { fetchMarketSnapshot, type MarketSnapshot } from "@/lib/market";
import { connection } from "@/lib/rpc";
import { formatUsd, shortAddress } from "@/lib/format";

// The fee and mark figures are read from mainnet and Tessera on every request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portage: pitch",
  description: "Why a fee-bearing Tessera token cannot quote a Meteora DBC launch, and how Portage clears it.",
};

const PROGRAM = "AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V";
const TKALSHI = "TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ";
const SITE = "https://portage-sol.vercel.app";

const devnet = (kind: "tx" | "address", id: string) => `https://explorer.solana.com/${kind}/${id}?cluster=devnet`;

const DEVNET_RUN: { step: string; what: string; sig: string; result: string; failed?: boolean }[] = [
  { step: "1", what: "Deploy the Portage program", sig: "2jbxWRNXxA5JLstSp7goeRwvq3NxX5SGJzgDhA53DqFKn8ipTSmYbQzCfDtdqQD6TobU8YbwXy8i1DgT1saRfy88", result: "332,888 bytes, slot 503782830" },
  { step: "2", what: "Create the tKalshi replica: Token-2022, 20 bps fee, 9 decimals", sig: "5Lm9Z985R9bnAQTbXRpemEmSMCUuehYP4QbZNMABWMcZ989nC4B3U1Dj6mHVnf5juW5WhHkvVtQxtEkhkV3FMd6K", result: "ok" },
  { step: "3", what: "DBC pool quoted in the raw replica", sig: "5ayYNhV7MSi5vqP5tcyLunnhYZoP1irMRNVq4Lf1nCGnMcA1wH1yAWpc4KtXTPnmLbe6hiAsZokJNpYv3PSzoiQk", result: "Failed on chain: 6080 InvalidTokenBadge", failed: true },
  { step: "4", what: "Wrap 100 replica", sig: "55NGuYcs2iyNdMUKVLcEKYdb446CdYgQBS7ifVZmAfytUk2boo934nZQFGb9iMwLUyGWpv9q1WnccawSxtPjCD5K", result: "Minted 99.800000000, vault 99.800000000" },
  { step: "5", what: "DBC pool quoted in the wrapped mint", sig: "3Ekh79t4kNMWrQNst2cYiyhGTGcqXQdb9n6w45Cw5ugjXK6ovZMPMbo2hWLKvSoGkS4xSL4xF5Jt1pQrLj7zwLRt", result: "Pool 8GN2...pQ1Q created" },
  { step: "6", what: "Buy on the pool: 1 wrapped in", sig: "4aw5qtUvAUvy1xCkHnN9C1rwdF47chafnZRURPjFAfNwKe1TnjCa1tY6TVcEzM9xbFfEhXkCXbFtAffdtQceriAZ", result: "31,186,470.580672 PTGD out" },
  { step: "7", what: "Unwrap 10", sig: "5eFhd7F9mqQTqnhAT1Nt7AdwAmoEtGbcnZeX7ScusMNg4MsKWdKw1fJkLasP4J4jDK9qURUQD8S9hwEmxQCv2bfH", result: "Received 9.980000000, vault 89.800000000" },
  { step: "8", what: "Set upgrade authority to none", sig: "3xxKiV2Gs5UXxb9nztEXRMDGkQSXWC3fsUx79HiEbzY479piYAdVotn65RZKQD6wGCAZqwpkiD24nFy8t9TcopKz", result: "Program immutable" },
];

const RAYDIUM_PAIRS: [string, string, string][] = [
  ["WASH/tKalshi", "$4,234", "0 buys, 0 sells in 6h"],
  ["YES/tKalshi", "$40,268", "3 buys, 7 sells in 24h"],
  ["BET/tKalshi", "$27,184", "down almost 16% in 24h"],
  ["DOGINU/tKalshi", "$30,776", "most active of the four"],
];

const SLIDES = [
  "Cover",
  "The border",
  "Who hits it",
  "The fix",
  "Live proof",
  "Devnet run",
  "Evidence",
  "Launch",
  "Why Solana",
  "Status",
  "Links",
];

function Slide({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <section
      data-slide={n + 1}
      aria-label={`Slide ${n + 1}: ${SLIDES[n]}`}
      className="fade-in flex min-h-[calc(100svh-3.5rem)] scroll-mt-4 flex-col justify-center border-b border-[var(--line)] py-12"
    >
      <p className="mono text-xs uppercase tracking-widest text-[var(--ink-3)]">
        Manifest No. P-{String(n + 1).padStart(2, "0")} &middot; {SLIDES[n]}
      </p>
      <div className="mt-6 min-w-0">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="ledger-row flex-wrap">
      <dt className="text-sm text-[var(--ink-2)]">{label}</dt>
      <dd className="mono min-w-0 text-right text-sm text-[var(--ink)]">{children}</dd>
    </div>
  );
}

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="max-w-4xl text-balance text-3xl leading-tight sm:text-5xl">{children}</h2>
);
const Lede = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-5 max-w-2xl text-pretty text-base text-[var(--ink-2)] sm:text-lg">{children}</p>
);

export default async function PitchPage() {
  const [marketRead, programRead] = await Promise.allSettled([
    fetchMarketSnapshot(),
    connection().getAccountInfo(new PublicKey(PROGRAM)),
  ]);
  const market: MarketSnapshot | null = marketRead.status === "fulfilled" ? marketRead.value : null;
  const marketError =
    marketRead.status === "rejected" ? (marketRead.reason instanceof Error ? marketRead.reason.message : "market data unavailable") : null;
  const programOnMainnet =
    programRead.status === "rejected"
      ? `read failed: ${programRead.reason instanceof Error ? programRead.reason.message : "rpc error"}`
      : programRead.value === null
        ? "null, not deployed"
        : `account exists, ${programRead.value.data.length} bytes`;
  const readAt = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const fee = (code: "tKalshi" | "tOpenAI") =>
    market ? `${market[code].transferFeeBps} bps` : "unavailable";

  return (
    <div className="pb-24">
      <Slide n={0}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <h1 className="max-w-4xl text-balance text-4xl leading-tight sm:text-6xl">
            One error code stands between Tessera&apos;s pre-IPO tokens and Meteora&apos;s launchpad.
          </h1>
          <Stamp variant="rejected">Error 6081</Stamp>
        </div>
        <Lede>
          Portage wraps tKalshi and tOpenAI 1:1 into a plain SPL mint held by an on-chain vault, so a token Meteora&apos;s
          Dynamic Bonding Curve refuses can quote a launch.
        </Lede>
        <dl className="mt-10 max-w-md">
          <Row label="tKalshi transfer fee, live">{fee("tKalshi")}</Row>
          <Row label="Read from mainnet at">{readAt}</Row>
        </dl>
      </Slide>

      <Slide n={1}>
        <H>
          DBC rejects any quote mint with a transfer fee, before it even looks for a badge.
        </H>
        <p className="mono mt-8 break-all text-lg text-[var(--rejected)] sm:text-2xl">
          6081 QuoteMintHasNonZeroTransferFee
        </p>
        <p className="mono mt-2 text-xs text-[var(--ink-3)]">dynamic-bonding-curve/src/utils/token.rs, is_supported_quote_mint</p>
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <dl>
            <Row label="tKalshi fee, this request">{fee("tKalshi")}</Row>
            <Row label="tOpenAI fee, this request">{fee("tOpenAI")}</Row>
            {market && (
              <Row label={`tKalshi Tessera mark${market.tKalshi.stale ? " (stale)" : ""}`}>
                {formatUsd(market.tKalshi.markPrice)}
              </Row>
            )}
          </dl>
          <p className="max-w-xl text-pretty text-sm text-[var(--ink-2)]">
            Both figures come from each mint&apos;s current-epoch fee schedule, read on this page load, the same read{" "}
            <span className="mono">/api/market</span> serves. The check runs again on swap, fee claim and migration, so no
            config tweak gets a fee-bearing Token-2022 mint through.
          </p>
        </div>
        {marketError && (
          <p className="mt-6 text-sm text-[var(--rejected)]">Could not read live market data: {marketError}</p>
        )}
      </Slide>

      <Slide n={2}>
        <H>So every tKalshi-quoted memecoin lands on Raydium, thin and with no floor.</H>
        <dl className="mt-10 max-w-3xl">
          {RAYDIUM_PAIRS.map(([pair, liq, activity]) => (
            <Row key={pair} label={<span className="mono text-[var(--ink)]">{pair}</span>}>
              {liq} liquidity &middot; {activity}
            </Row>
          ))}
        </dl>
        <p className="mono mt-4 text-xs text-[var(--ink-3)]">
          DexScreener snapshot, 2026-09-24. Not re-pulled; liquidity moves by the minute.
        </p>
        <Lede>One real exit clears any of these books, and none carries recourse if the launch never graduates.</Lede>
      </Slide>

      <Slide n={3}>
        <H>The fee lives on the token being wrapped, not on the token DBC reads.</H>
        <ol className="mt-10 max-w-3xl border-t border-[var(--line-strong)]">
          {[
            ["Deposit", "wrap moves tKalshi into a Token-2022 vault account with transfer_checked."],
            ["Measure", "The program reads back exactly what arrived, net of Tessera's own fee."],
            ["Mint", "It mints that amount of a legacy SPL mint with zero extensions. DBC reads its fee as zero."],
            ["Assert", "Every wrap and unwrap ends on wrapped_mint.supply <= vault_token.amount."],
          ].map(([k, v], i) => (
            <li key={k} className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-b border-dashed border-[var(--line)] py-4 sm:grid-cols-[2.5rem_8rem_1fr]">
              <span className="mono text-sm text-[var(--ink-3)]">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-[family-name:var(--font-display)] text-lg">{k}</span>
              <span className="col-start-2 text-sm text-[var(--ink-2)] sm:col-start-3">{v}</span>
            </li>
          ))}
        </ol>
        <Lede>
          No change to Meteora&apos;s program. Unwrap burns the wrapped token and returns the underlying, paying Tessera&apos;s
          fee on the way out.
        </Lede>
      </Slide>

      <Slide n={4}>
        <H>Same createConfig call, simulated live on mainnet. Only the quote mint differs.</H>
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="border-t-2 border-[var(--rejected)] pt-4">
            <Stamp variant="rejected">Rejected</Stamp>
            <p className="mt-4 text-sm text-[var(--ink-2)]">Quote: raw tKalshi</p>
            <p className="mono mt-2 break-all text-sm">{`"err":{"InstructionError":[0,{"Custom":6081}]}`}</p>
          </div>
          <div className="border-t-2 border-[var(--accent)] pt-4">
            <Stamp variant="cleared">Cleared</Stamp>
            <p className="mt-4 text-sm text-[var(--ink-2)]">Quote: plain SPL mint</p>
            <p className="mono mt-2 break-all text-sm">{`"err":null`} &middot; 174,050 compute units</p>
          </div>
        </div>
        <p className="mt-8 text-sm text-[var(--ink-2)]">
          Run it yourself:{" "}
          <Link href="/proof" className="mono underline decoration-[var(--line-strong)]">
            portage-sol.vercel.app/proof
          </Link>
        </p>
      </Slide>

      <Slide n={5}>
        <H>On devnet the whole loop has already run for real.</H>
        <p className="mt-4 max-w-2xl text-sm text-[var(--ink-2)]">
          tKalshi does not exist on devnet, so the run uses a Token-2022 replica with the same shape. Program{" "}
          <a href={devnet("address", PROGRAM)} target="_blank" rel="noreferrer" className="mono underline decoration-[var(--line-strong)]">
            {shortAddress(PROGRAM)}
          </a>
          , every step on the explorer.
        </p>
        <ol className="mt-8 border-t border-[var(--line-strong)]">
          {DEVNET_RUN.map((r) => (
            <li
              key={r.step}
              className="grid grid-cols-[2rem_1fr] gap-x-4 gap-y-1 border-b border-dashed border-[var(--line)] py-2.5 text-sm md:grid-cols-[2rem_1.3fr_1fr_7rem]"
            >
              <span className="mono text-[var(--ink-3)]">{r.step}</span>
              <span>{r.what}</span>
              <span className={`mono col-start-2 md:col-start-3 ${r.failed ? "text-[var(--rejected)]" : "text-[var(--ink)]"}`}>
                {r.result}
              </span>
              <a
                href={devnet("tx", r.sig)}
                target="_blank"
                rel="noreferrer"
                className="mono col-start-2 text-[var(--ink-2)] underline decoration-[var(--line-strong)] md:col-start-4 md:text-right"
              >
                {shortAddress(r.sig)}
              </a>
            </li>
          ))}
        </ol>
        <p className="mt-4 max-w-3xl text-sm text-[var(--ink-2)]">
          Step 3 was sent with preflight skipped so the rejection is on chain. Devnet stopped it one gate earlier, at the
          badge check, instead of 6081. Either way a raw fee-bearing mint cannot quote DBC. After the run the wrapped supply
          is 89.8 and the vault holds 89.8.
        </p>
      </Slide>

      <Slide n={6}>
        <H>The accounting holds under load, against the real tKalshi mint account.</H>
        <dl className="mt-10 max-w-3xl">
          <Row label="Vault test suite (litesvm, real mainnet tKalshi fixture)">8/8 passing</Row>
          <Row label="Wrap 1,234,567,891 base units">1,232,098,755 minted</Row>
          <Row label="Unwrap all of it">1,229,634,557 returned</Row>
          <Row label="Round-trip cost">about 40 bps, 20 per leg</Row>
          <Row label="Invariant, 30 random cycles, 3 users">held after every instruction</Row>
          <Row label="Mint with PermanentDelegate">rejected at init_vault</Row>
        </dl>
      </Slide>

      <Slide n={7}>
        <H>A launch configured against the live curve, simulated before a lamport moves.</H>
        <dl className="mt-10 max-w-3xl">
          <Row label="Anti-snipe fee">2,500 bps to 100 bps over 300 s</Row>
          <Row label="Graduation">DAMM v2, LP permanently locked</Row>
          <Row label="Start price anchor">live Tessera tKalshi mark</Row>
          <Row label="Launch simulation, 2026-09-25">err null, start cap within 5% of $50,000</Row>
          <Row label="tKalshi DEX premium to mark, 2026-09-25">7.82%</Row>
          <Row label="tOpenAI DEX premium to mark, 2026-09-25">28.02%</Row>
        </dl>
        <Lede>That gap between the DEX and Tessera&apos;s desk is what a wrap-and-launch can close.</Lede>
        <p className="mt-4 text-sm">
          <Link href="/launch" className="mono underline decoration-[var(--line-strong)]">/launch</Link>
          <span className="text-[var(--ink-3)]"> &middot; </span>
          <Link href="/market" className="mono underline decoration-[var(--line-strong)]">/market</Link>
        </p>
      </Slide>

      <Slide n={8}>
        <H>One program-owned account holds a fee-bearing token and mints a second one with its own extension set.</H>
        <Lede>
          That is why this is Solana-specific: Token-2022 extensions live per mint, so the vault can custody the fee-bearing
          token and issue a clean one, live, with nothing faked in between.
        </Lede>
        <dl className="mt-10 max-w-3xl">
          <Row label="Tessera freeze authority on tKalshi">can freeze any holder, the vault included</Row>
          <Row label="Tessera fee authority">can raise the fee; Portage reads what arrived, not a fixed rate</Row>
          <Row label="Wrap and unwrap">permissionless, has_one checked</Row>
        </dl>
      </Slide>

      <Slide n={9}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <H>Mainnet deploy is the next step, not a done one.</H>
          <Stamp variant="pending">Mainnet pending</Stamp>
        </div>
        <dl className="mt-10 max-w-3xl">
          <Row label="Mainnet getAccountInfo for the program, this request">{programOnMainnet}</Row>
          <Row label="Rent-exempt minimum to deploy (329,912-byte program)">1.6777 SOL, about 1.68</Row>
          <Row label="Devnet program">deployed, used end to end, immutable</Row>
          <Row label="Mainnet side today">proven by live simulation against real tKalshi</Row>
          <Row label="Blocked until deploy">mainnet wrap, unwrap, real vaults on /vaults</Row>
        </dl>
        <Lede>
          Once it is live, a small basis-point cut on each wrap is the revenue line. That cut is not in the program yet.
        </Lede>
      </Slide>

      <Slide n={10}>
        <H>Portage</H>
        <dl className="mt-10 max-w-3xl">
          <Row label="Live site">
            <a href={SITE} target="_blank" rel="noreferrer" className="underline decoration-[var(--line-strong)]">portage-sol.vercel.app</a>
          </Row>
          <Row label="Live proof">
            <Link href="/proof" className="underline decoration-[var(--line-strong)]">/proof</Link>
          </Row>
          <Row label="tKalshi mint">
            <AddressLink value={TKALSHI} />
          </Row>
          <Row label="Devnet program">
            <a href={devnet("address", PROGRAM)} target="_blank" rel="noreferrer" className="underline decoration-[var(--line-strong)]">
              {shortAddress(PROGRAM)}
            </a>
          </Row>
          <Row label="tKalshi fee at close">{fee("tKalshi")}</Row>
        </dl>
      </Slide>

      <DeckNav total={SLIDES.length} />
    </div>
  );
}
