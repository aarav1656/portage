import type { Metadata } from "next";
import Link from "next/link";
import { AddressLink } from "@/components/address-link";
import { DeckNav } from "@/components/deck-nav";
import { Stamp } from "@/components/stamp";
import { PublicKey } from "@solana/web3.js";
import { fetchMarketSnapshot, type MarketSnapshot } from "@/lib/market";
import { connection } from "@/lib/rpc";
import { formatUsd, shortAddress } from "@/lib/format";
import { ArticleLine, Exhibit, TweetCard, type Article, type Tweet } from "@/components/evidence";
import dbcTokenRs from "@/public/evidence/dbc-token-rs.webp";
import meteoraDocsBadge from "@/public/evidence/meteora-docs-badge.webp";
import meteoraDbcConfig from "@/public/evidence/meteora-dbc-config.webp";
import tesseraExplore from "@/public/evidence/tessera-explore.webp";
import tesseraDocsFee from "@/public/evidence/tessera-docs-fee.webp";
import explorerTkalshi from "@/public/evidence/explorer-tkalshi.webp";
import solscanTkalshi from "@/public/evidence/solscan-tkalshi.webp";
import dexWash from "@/public/evidence/dex-wash.webp";
import devnetProgram from "@/public/evidence/devnet-program.webp";
import devnetWrap from "@/public/evidence/devnet-wrap.webp";
import devnetReject from "@/public/evidence/devnet-reject.webp";
import xMeteoraVideo from "@/public/evidence/x-meteora-dbc-video.webp";
import avMeteoraAG from "@/public/evidence/avatars/MeteoraAG.webp";
import avMeteoraEco from "@/public/evidence/avatars/MeteoraEco.webp";
import avTessera from "@/public/evidence/avatars/Tessera_PE.webp";
import avIndexbank from "@/public/evidence/avatars/indexbankfun.webp";

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

// api.dexscreener.com/token-pairs/v1/solana/<tKalshi>, pairs quoted in tKalshi, read 2026-09-25 07:08 UTC.
const RAYDIUM_PAIRS: [string, string, string][] = [
  ["WASH/tKalshi", "$4,241", "1 buy, 4 sells, $4.56 volume in 24h"],
  ["BET/tKalshi", "$26,138", "6 buys, 9 sells in 24h, down 6.9%"],
  ["YES/tKalshi", "$36,348", "4 buys, 11 sells in 24h, down 19.3%"],
  ["DOGINU/tKalshi", "$31,091", "48 buys, 49 sells in 24h, the most active"],
];

// Each fetched with curl -s https://api.fxtwitter.com/<user>/status/<id> on 2026-09-25; text is verbatim.
const METEORA_TWEETS: Tweet[] = [
  {
    url: "https://x.com/MeteoraAG/status/2097559327855034437",
    name: "Meteora",
    handle: "MeteoraAG",
    date: "Sep 9, 2026",
    avatar: avMeteoraAG,
    text: "Meteora DBC now supports any token pair on @solana.\n\nStock tokens, RWAs, and other Token-2022 assets can now be used as quote tokens in DBC launch configurations.\n\nIf it\u2019s on Solana, you can launch it on Meteora.",
    media: { src: xMeteoraVideo, alt: "Frame from the attached video: Any token. Any pair." },
  },
  {
    url: "https://x.com/MeteoraEco/status/2098687815534199216",
    name: "Meteora Ecosystem",
    handle: "MeteoraEco",
    date: "Sep 12, 2026",
    avatar: avMeteoraEco,
    text: "Meteora DBC unlocks permissionless launches on Solana.\n\nBuilders can create launchpads and entirely new products using stock tokens and other assets as quote pairs.",
    excerpt: true,
    quote: {
      title: "What Meteora DBC Release 0.2.1 means for Builders on Solana",
      text: "Non-zero transfer fee is never allowed, badge or not. The program re-checks this at badge creation, at config/pool creation, and on every instruction that moves quote tokens. It is a hard invariant.",
    },
  },
];

const RECORD_TWEETS: Tweet[] = [
  {
    url: "https://x.com/Tessera_PE/status/2021875468979613877",
    name: "Tessera Lab",
    handle: "Tessera_PE",
    date: "Feb 12, 2026",
    avatar: avTessera,
    text: "SpaceX is now live on Solana\n\nTSPXcLV76s6V2zDiZQ18kBfcbnjaE2ZzNT3ga2Pd99v",
  },
  {
    url: "https://x.com/Tessera_PE/status/2098458415055987070",
    name: "Tessera Lab",
    handle: "Tessera_PE",
    date: "Sep 11, 2026",
    avatar: avTessera,
    text: "Considering some big changes this next week for you trenchers out there\n\nIf you trade T assets, or @LaunchOnSF tessera pairings, what do you most want to see from us?",
  },
  {
    url: "https://x.com/Tessera_PE/status/2064002699129929854",
    name: "Tessera Lab",
    handle: "Tessera_PE",
    date: "Jun 8, 2026",
    avatar: avTessera,
    text: "Tessera is Launching OpenAI June 24\n\nYou have 2 weeks to become eligible https://app.tessera.pe/auction/T-OpenAI",
    excerpt: true,
  },
  {
    url: "https://x.com/indexbankfun/status/2058204698646020322",
    name: "Indexbank",
    handle: "indexbankfun",
    date: "May 23, 2026",
    avatar: avIndexbank,
    text: "[...] one xStock (PGX) whose Token-2022 mint refuses every swap aggregator we tried. [...]\n\n3. PGX removed. Until the mint authority drops the permanent delegate, we can't route it.",
    excerpt: true,
  },
];

const ARTICLES: Article[] = [
  {
    outlet: "Meteora Docs",
    title: "DBC Token 2022 Support",
    date: "read 2026-09-25",
    href: "https://docs.meteora.ag/core-products/dbc/token-2022-support",
    quote: "A badge does not allow a non-zero transfer fee. Current and any scheduled transfer_fee_basis_points must be 0.",
  },
  {
    outlet: "Meteora Docs",
    title: "DBC Launch Configuration",
    date: "read 2026-09-25",
    href: "https://docs.meteora.ag/core-products/dbc/launch-configurations",
    quote: "Token 2022 quote mints are permissionless only with metadata-related extensions and a zero transfer fee.",
  },
  {
    outlet: "Tessera Documentation",
    title: "How do T-Tokens Work?",
    date: "updated 2026-08-13",
    href: "https://docs.tessera.pe/overview/how-do-tessera-token-work",
    quote: "A 0% fee applies on acquisitions, and a 0.2% fee applies on sells/transfers.",
  },
  {
    outlet: "Raydium Docs",
    title: "Token-2022 transfer fees in swaps",
    date: "read 2026-09-25",
    href: "https://docs.raydium.io/algorithms/token-2022-transfer-fees",
    quote: "If the swap program is naive and uses the raw amount_in argument, the invariant check fails because the vault got less than the program thinks.",
  },
];

const SLIDES = [
  "Cover",
  "The border",
  "Any pair, but",
  "Who hits it",
  "The fix",
  "Live proof",
  "Devnet run",
  "Accounting",
  "The record",
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
        <H>DBC rejects any quote mint with a transfer fee, badge or not.</H>
        <p className="mono mt-8 break-all text-lg text-[var(--rejected)] sm:text-2xl">
          6081 QuoteMintHasNonZeroTransferFee
        </p>
        <p className="mono mt-2 text-xs text-[var(--ink-3)]">dynamic-bonding-curve/src/utils/token.rs, is_supported_quote_mint</p>
        <div className="mt-10 grid items-start gap-6 lg:grid-cols-12">
          <div className="grid gap-6 lg:col-span-7">
            <Exhibit
              no="01"
              src={dbcTokenRs}
              alt="Meteora dynamic-bonding-curve token.rs lines 195 to 226: require is_transfer_fee_zero, else PoolError::QuoteMintHasNonZeroTransferFee"
              href="https://github.com/MeteoraAg/dynamic-bonding-curve/blob/f552f20aa3c1c7631427c3827aeea7c58b902813/programs/dynamic-bonding-curve/src/utils/token.rs#L201-L221"
              note="Meteora's own source, pinned at commit f552f20. Line 217: never allow a non-zero transfer fee."
              sizes="(min-width: 1024px) 58vw, 100vw"
            />
            <p className="max-w-2xl text-pretty text-sm text-[var(--ink-2)]">
              Both fees come from each mint&apos;s current-epoch fee schedule, read on this page load, the same read{" "}
              <span className="mono">/api/market</span> serves. The check runs again on swap, fee claim and migration, so no
              config tweak gets a fee-bearing Token-2022 mint through.
            </p>
          </div>
          <div className="grid gap-6 lg:col-span-5">
            <Exhibit
              no="02"
              src={meteoraDocsBadge}
              alt="Meteora docs, DBC Token 2022 Support: a badge does not allow a non-zero transfer fee"
              href="https://docs.meteora.ag/core-products/dbc/token-2022-support"
              note="Meteora's docs: a token badge cannot waive the fee rule."
              sizes="(min-width: 1024px) 40vw, 100vw"
            />
            <dl>
              <Row label="tKalshi fee, this request">{fee("tKalshi")}</Row>
              <Row label="tOpenAI fee, this request">{fee("tOpenAI")}</Row>
              {market && (
                <Row label={`tKalshi Tessera mark${market.tKalshi.stale ? " (stale)" : ""}`}>
                  {formatUsd(market.tKalshi.markPrice)}
                </Row>
              )}
            </dl>
          </div>
        </div>
        {marketError && (
          <p className="mt-6 text-sm text-[var(--rejected)]">Could not read live market data: {marketError}</p>
        )}
      </Slide>

      <Slide n={2}>
        <H>On Sep 9 Meteora opened DBC to stock tokens. The same release keeps fee-bearing ones out.</H>
        <div className="mt-10 grid items-start gap-6 lg:grid-cols-12">
          <TweetCard t={METEORA_TWEETS[0]} className="lg:col-span-4" />
          <TweetCard t={METEORA_TWEETS[1]} className="lg:col-span-4 lg:mt-12" />
          <Exhibit
            no="03"
            className="lg:col-span-4 lg:mt-4"
            src={meteoraDbcConfig}
            alt="Meteora launch app, Configure DBC form, with the tKalshi mint pasted into the Quote Mint field"
            href="https://launch.meteora.ag/"
            note="Meteora's launch app with the tKalshi mint pasted as Quote Mint. The form takes the address; the program check in Exhibit 01 is what refuses it."
            sizes="(min-width: 1024px) 33vw, 100vw"
          />
        </div>
        <Lede>Tessera&apos;s T-tokens carry a 0.2% transfer fee (Exhibit 07), so the door Meteora opened stays shut for them.</Lede>
      </Slide>

      <Slide n={3}>
        <H>Tessera&apos;s tKalshi is real, trading, and fee-bearing on every transfer.</H>
        <div className="mt-10 grid items-start gap-6 lg:grid-cols-12">
          <div className="grid gap-6 lg:col-span-7">
            <Exhibit
              no="04"
              src={tesseraExplore}
              alt="Tessera app Explore page listing SpaceX, Kalshi and OpenAI tokens with auction prices"
              href="https://app.tessera.pe/"
              note="Tessera's app lists T-SpaceX, T-Kalshi and T-OpenAI (terms dialog closed for the capture)."
              sizes="(min-width: 1024px) 58vw, 100vw"
            />
            <Exhibit
              no="05"
              src={solscanTkalshi}
              alt="Solscan token page for T-Kalshi: Token 2022 Program owner, 2,841 holders, token extensions true"
              href={`https://solscan.io/token/${TKALSHI}`}
              note="Solscan: owned by the Token 2022 program, 2,841 holders at capture."
              sizes="(min-width: 1024px) 58vw, 100vw"
            />
          </div>
          <div className="grid gap-6 lg:col-span-5">
            <Exhibit
              no="06"
              src={explorerTkalshi}
              alt="Solana Explorer, T-Kalshi Token-2022 mint, Transfer Fee Config enabled, current fee rate 0.2 percent"
              href={`https://explorer.solana.com/address/${TKALSHI}/token-extensions`}
              note="Solana Explorer: transferFeeConfig enabled, current fee rate 0.2%, no practical maximum."
              sizes="(min-width: 1024px) 40vw, 100vw"
            />
            <Exhibit
              no="07"
              src={tesseraDocsFee}
              alt="Tessera documentation: a 0.2% fee applies on sells and transfers"
              href="https://docs.tessera.pe/overview/how-do-tessera-token-work"
              note="Tessera's docs state the same 0.2% on sells and transfers."
              sizes="(min-width: 1024px) 40vw, 100vw"
            />
          </div>
        </div>

        <h3 className="mt-16 max-w-3xl text-balance text-2xl leading-snug sm:text-3xl">
          So every tKalshi-quoted memecoin lands on a plain Raydium pool, thin and with no curve.
        </h3>
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <dl>
              {RAYDIUM_PAIRS.map(([pair, liq, activity]) => (
                <Row key={pair} label={<span className="mono text-[var(--ink)]">{pair}</span>}>
                  {liq} liquidity &middot; {activity}
                </Row>
              ))}
            </dl>
            <p className="mono mt-4 break-all text-xs text-[var(--ink-3)]">
              api.dexscreener.com/token-pairs/v1/solana/{shortAddress(TKALSHI)}, read 2026-09-25 07:08 UTC. Liquidity moves by the minute.
            </p>
            <Lede>One real exit clears any of these books, and none carries recourse if the launch never graduates.</Lede>
          </div>
          <Exhibit
            no="08"
            className="max-w-sm lg:col-span-4"
            src={dexWash}
            alt="DEX Screener panel for WASH/tKalshi on Raydium CPMM: liquidity 4.2K dollars, 5 transactions and 4 dollars volume in 24 hours"
            href="https://dexscreener.com/solana/dgmueamprmzjzkuzsxz5snpfgfv5kwuyalrevsxabjqt"
            note="WASH/tKalshi on Raydium CPMM: $4 of volume in a day."
            sizes="(min-width: 1024px) 25vw, 100vw"
          />
        </div>
      </Slide>

      <Slide n={4}>
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

      <Slide n={5}>
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

      <Slide n={6}>
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
        <div className="mt-10 grid items-start gap-6 lg:grid-cols-12">
          <Exhibit
            no="09"
            className="lg:col-span-5"
            src={devnetProgram}
            alt="Solana Explorer devnet, Portage program account: executable yes, upgradeable no, last deployed slot 503,782,830"
            href={devnet("address", PROGRAM)}
            note="The program on devnet: executable, upgradeable No."
            sizes="(min-width: 1024px) 40vw, 100vw"
          />
          <div className="grid gap-6 lg:col-span-7">
            <Exhibit
              no="10"
              src={devnetReject}
              alt="Devnet transaction logs: DynamicBondingCurve CreateConfig, AnchorError InvalidTokenBadge, error number 6080"
              href={devnet("tx", DEVNET_RUN[2].sig)}
              note="Step 3, raw replica as quote: DBC refuses it on chain."
              sizes="(min-width: 1024px) 58vw, 100vw"
            />
            <Exhibit
              no="11"
              src={devnetWrap}
              alt="Devnet wrap transaction token balances: minus 100 replica from the wallet, plus 99.8 into the vault, plus 99.8 wrapped minted"
              href={devnet("tx", DEVNET_RUN[3].sig)}
              note="Step 4, wrap: 100 replica leaves the wallet, 99.8 lands in the vault, exactly 99.8 wrapped is minted."
              sizes="(min-width: 1024px) 58vw, 100vw"
            />
          </div>
        </div>
      </Slide>

      <Slide n={7}>
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

      <Slide n={8}>
        <H>The record: people launching against Tessera pairs, and builders hitting Token-2022 walls.</H>
        <div className="mt-10 grid items-start gap-6 md:grid-cols-2 lg:grid-cols-12">
          <TweetCard t={RECORD_TWEETS[0]} className="lg:col-span-3" />
          <TweetCard t={RECORD_TWEETS[1]} className="lg:col-span-5 lg:mt-10" />
          <TweetCard t={RECORD_TWEETS[3]} className="md:col-span-2 lg:col-span-4 lg:mt-3" />
          <TweetCard t={RECORD_TWEETS[2]} className="md:col-span-2 lg:col-span-4 lg:mt-2" />
          <div className="md:col-span-2 lg:col-span-8 lg:mt-6">
            <h3 className="mono text-xs uppercase tracking-widest text-[var(--ink-3)]">Written down elsewhere</h3>
            <ol className="mt-2 border-t border-[var(--line-strong)]">
              {ARTICLES.map((a) => (
                <ArticleLine key={a.href} a={a} />
              ))}
            </ol>
          </div>
        </div>
      </Slide>

      <Slide n={9}>
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

      <Slide n={10}>
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

      <Slide n={11}>
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

      <Slide n={12}>
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
