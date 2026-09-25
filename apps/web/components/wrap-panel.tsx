"use client";
import { useMemo, useState } from "react";
import { calculateFee } from "@solana/spl-token";
import { TESSERA_TOKENS, type TesseraKey } from "@/lib/tessera";
import type { MarketSnapshot } from "@/lib/market";
import { formatAmount, formatBps, parseAmount } from "@/lib/format";
import { ConnectArea } from "@/components/connect-area";
import { AddressLink } from "@/components/address-link";
import type { WalletState } from "@/lib/use-wallet";

type Mode = "wrap" | "unwrap";
type Phase = "idle" | "building" | "awaiting-signature" | "submitting" | "done" | "error";

export function WrapPanel({
  market,
  marketError,
  initialToken = "Kalshi",
}: {
  market: MarketSnapshot | null;
  marketError: string | null;
  initialToken?: TesseraKey;
}) {
  const [token, setToken] = useState<TesseraKey>(initialToken);
  const [mode, setMode] = useState<Mode>("wrap");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [phaseError, setPhaseError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const code = TESSERA_TOKENS[token].code;
  const wrappedSymbol = `wt${TESSERA_TOKENS[token].label.replace("T-", "").toUpperCase()}`;
  const tokenMarket = market?.[code as "tKalshi" | "tOpenAI"] ?? null;

  const breakdown = useMemo(() => {
    if (tokenMarket === null || amount.trim() === "") return null;
    let raw: bigint;
    try {
      raw = parseAmount(amount, tokenMarket.decimals);
    } catch {
      return null;
    }
    if (raw <= 0n) return null;
    const fee = calculateFee(
      { epoch: 0n, maximumFee: BigInt(tokenMarket.maxFeeRaw), transferFeeBasisPoints: tokenMarket.transferFeeBps },
      raw,
    );
    const received = raw - fee;
    return { raw, fee, received, decimals: tokenMarket.decimals };
  }, [amount, tokenMarket]);

  function reset() {
    setPhase("idle");
    setPhaseError(null);
    setSignature(null);
  }

  async function submit(wallet: WalletState) {
    if (wallet.connected === null || breakdown === null) return;
    setPhase("building");
    setPhaseError(null);
    setSignature(null);
    try {
      const res = await fetch(`/api/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user: wallet.connected.address, token, amountRaw: breakdown.raw.toString() }),
      });
      const json = (await res.json()) as { txBase64?: string; error?: string };
      if (!res.ok || !json.txBase64) throw new Error(json.error ?? "failed to build transaction");
      setPhase("awaiting-signature");
      const sig = await wallet.signAndSend(json.txBase64);
      setPhase("submitting");
      setSignature(sig);
      setPhase("done");
    } catch (err) {
      setPhaseError(err instanceof Error ? err.message : "transaction failed");
      setPhase("error");
    }
  }

  return (
    <section className="panel fade-in p-4 sm:p-5" aria-label="Wrap and unwrap">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">Wrap / unwrap</h2>
        <div className="flex gap-1" role="group" aria-label="Direction">
          {(["wrap", "unwrap"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                reset();
              }}
              className={`btn px-3 py-1.5 text-xs capitalize ${mode === m ? "btn-primary" : "btn-outline"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-1" role="group" aria-label="Token">
        {(Object.keys(TESSERA_TOKENS) as TesseraKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setToken(key);
              reset();
            }}
            className={`btn px-3 py-1.5 text-xs ${token === key ? "btn-primary" : "btn-outline"}`}
          >
            {TESSERA_TOKENS[key].label}
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="text-sm text-[var(--ink-2)]">
          Amount to {mode} ({mode === "wrap" ? TESSERA_TOKENS[token].label : wrappedSymbol})
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            reset();
          }}
          placeholder="0.00"
          className="mt-1 w-full px-3 py-2 text-base"
        />
      </label>

      {marketError !== null ? (
        <p className="mt-3 text-sm text-[var(--rejected)]">Live fee unavailable: {marketError}</p>
      ) : tokenMarket === null ? (
        <div className="mt-3 h-5 w-2/3 skeleton" aria-label="Loading live fee" />
      ) : breakdown !== null ? (
        <p className="mt-3 text-sm text-[var(--ink-2)]">
          You {mode === "wrap" ? "deposit" : "burn"}{" "}
          <span className="mono text-[var(--ink)]">
            {formatAmount(breakdown.raw, breakdown.decimals)} {mode === "wrap" ? TESSERA_TOKENS[token].label : wrappedSymbol}
          </span>
          . The vault {mode === "wrap" ? "receives" : "sends"}{" "}
          <span className="mono text-[var(--ink)]">
            {formatAmount(breakdown.received, breakdown.decimals)} {TESSERA_TOKENS[token].label}
          </span>{" "}
          after the {formatBps(tokenMarket.transferFeeBps)} Tessera transfer fee. You get{" "}
          <span className="mono text-[var(--ink)]">
            {formatAmount(breakdown.received, breakdown.decimals)} {mode === "wrap" ? wrappedSymbol : TESSERA_TOKENS[token].label}
          </span>
          .
        </p>
      ) : (
        <p className="mt-3 text-sm text-[var(--ink-3)]">Enter an amount to see the manifest breakdown.</p>
      )}

      <div className="mt-5 border-t border-[var(--line)] pt-4">
        <ConnectArea>
          {(wallet) => (
            <div className="mt-4">
              <button
                type="button"
                disabled={wallet.connected === null || breakdown === null || phase === "building" || phase === "awaiting-signature" || phase === "submitting"}
                onClick={() => void submit(wallet)}
                className="btn btn-primary w-full sm:w-auto"
              >
                {phase === "building" && "Building transaction..."}
                {phase === "awaiting-signature" && "Confirm in wallet..."}
                {phase === "submitting" && "Submitting..."}
                {(phase === "idle" || phase === "done" || phase === "error") && (mode === "wrap" ? "Wrap" : "Unwrap")}
              </button>
              {phase === "error" && phaseError !== null && <p className="mt-2 text-sm text-[var(--rejected)]">{phaseError}</p>}
              {phase === "done" && signature !== null && (
                <p className="mt-2 text-sm text-[var(--accent)]">
                  Sent. Signature: <AddressLink value={signature} kind="tx" />
                </p>
              )}
            </div>
          )}
        </ConnectArea>
      </div>
    </section>
  );
}
