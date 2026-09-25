"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectArea } from "@/components/connect-area";
import { AddressLink } from "@/components/address-link";
import { formatAmount, parseAmount } from "@/lib/format";
import type { DevnetAction } from "@/lib/devnet";
import type { WalletState } from "@/lib/use-wallet";

type Holdings = { sol: string; replica: string; wrapped: string; base: string };
type TxHoldings = { [K in keyof Holdings]: string | null };
type Receipt =
  | { status: "pending" }
  | { status: "failed"; err: string; slot: number }
  | { status: "confirmed" | "finalized"; slot: number; before: TxHoldings; after: TxHoldings; vaultBalance: string; wrappedSupply: string };
type Phase =
  | { kind: "idle" }
  | { kind: "building" }
  | { kind: "signing"; expected: string; min: string }
  | { kind: "polling"; sig: string; expected: string; min: string; waited: number }
  | { kind: "landed"; sig: string; receipt: Extract<Receipt, { slot: number; before: TxHoldings }> }
  | { kind: "error"; message: string; sig?: string };

const ACTIONS: Record<DevnetAction, { label: string; spend: string; get: string; getDecimals: number; note: string }> = {
  wrap: { label: "Wrap", spend: "replica tKalshi", get: "wrapped", getDecimals: 9, note: "Portage wrap: deposit replica, mint wrapped net of the 20 bps fee." },
  unwrap: { label: "Unwrap", spend: "wrapped", get: "replica tKalshi", getDecimals: 9, note: "Portage unwrap: burn wrapped, the vault sends replica and the fee is taken on the way out." },
  buy: { label: "Buy", spend: "wrapped", get: "PTGD", getDecimals: 6, note: "Meteora DBC swap: pay wrapped into the pool quoted in the wrapped mint, receive PTGD." },
};
const ROWS: { key: keyof Holdings; label: string; decimals: number }[] = [
  { key: "sol", label: "SOL", decimals: 9 },
  { key: "replica", label: "Replica tKalshi", decimals: 9 },
  { key: "wrapped", label: "Wrapped", decimals: 9 },
  { key: "base", label: "PTGD", decimals: 6 },
];
const POLL_MS = 1500;
const POLL_LIMIT_MS = 90_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Ledger({ address, refreshKey }: { address: string; refreshKey: number }) {
  const [h, setH] = useState<Holdings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setErr(null);
    fetch(`/api/devnet/holdings?user=${address}`)
      .then(async (r) => {
        const j = (await r.json()) as Holdings & { error?: string };
        if (!r.ok) throw new Error(j.error ?? "holdings read failed");
        if (live) setH(j);
      })
      .catch((e: unknown) => live && setErr(e instanceof Error ? e.message : "holdings read failed"));
    return () => {
      live = false;
    };
  }, [address, refreshKey]);
  if (err !== null) return <p className="mt-3 text-sm text-[var(--rejected)]">{err}</p>;
  if (h === null) return <div className="mt-3 h-24 skeleton" aria-label="Loading wallet holdings" />;
  const empty = BigInt(h.replica) === 0n && BigInt(h.wrapped) === 0n;
  return (
    <div className="mt-3">
      <dl>
        {ROWS.map((r) => (
          <div key={r.key} className="ledger-row">
            <dt className="text-sm text-[var(--ink-2)]">{r.label}</dt>
            <dd className="mono text-sm">{formatAmount(BigInt(h[r.key]), r.decimals, r.decimals)}</dd>
          </div>
        ))}
      </dl>
      {empty && (
        <p className="mt-2 text-sm text-[var(--ink-3)]">
          This wallet holds no replica yet. The operator funds it with{" "}
          <span className="mono text-[var(--ink-2)]">pnpm --filter @portage/dbc fund-devnet {address}</span>.
        </p>
      )}
    </div>
  );
}

export function DevnetPanel() {
  const router = useRouter();
  const [action, setAction] = useState<DevnetAction>("wrap");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [refreshKey, setRefreshKey] = useState(0);
  const a = ACTIONS[action];
  const busy = phase.kind === "building" || phase.kind === "signing" || phase.kind === "polling";

  let raw: bigint | null = null;
  try {
    raw = amount.trim() === "" ? null : parseAmount(amount, 9);
  } catch {
    raw = null;
  }

  const run = useCallback(
    async (wallet: WalletState) => {
      if (wallet.connected === null || raw === null || raw <= 0n) return;
      const user = wallet.connected.address;
      setPhase({ kind: "building" });
      let sig: string | undefined;
      try {
        const res = await fetch("/api/devnet/tx", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, user, amountRaw: raw.toString() }),
        });
        const built = (await res.json()) as { txBase64?: string; minRaw?: string; expectedRaw?: string; error?: string };
        if (!res.ok || !built.txBase64 || !built.minRaw || !built.expectedRaw) throw new Error(built.error ?? "failed to build transaction");
        const expected = built.expectedRaw;
        const min = built.minRaw;
        setPhase({ kind: "signing", expected, min });
        sig = await wallet.signAndSend(built.txBase64, "solana:devnet");
        const started = Date.now();
        for (;;) {
          const waited = Date.now() - started;
          setPhase({ kind: "polling", sig, expected, min, waited });
          const r = await fetch(`/api/devnet/receipt?sig=${sig}&user=${user}`, { cache: "no-store" });
          const receipt = (await r.json()) as Receipt & { error?: string };
          if (!r.ok) throw new Error(receipt.error ?? "receipt read failed");
          if (receipt.status === "failed") throw new Error(`transaction failed on chain: ${receipt.err}`);
          if (receipt.status === "confirmed" || receipt.status === "finalized") {
            setPhase({ kind: "landed", sig, receipt });
            setRefreshKey((k) => k + 1);
            router.refresh();
            if (receipt.status === "confirmed") void followToFinal(sig, user, receipt);
            return;
          }
          if (waited > POLL_LIMIT_MS) throw new Error(`not confirmed after ${POLL_LIMIT_MS / 1000}s`);
          await sleep(POLL_MS);
        }
      } catch (err) {
        setPhase({ kind: "error", message: err instanceof Error ? err.message : "transaction failed", sig });
      }
    },
    [action, raw, router],
  );

  async function followToFinal(sig: string, user: string, first: Extract<Receipt, { slot: number; before: TxHoldings }>) {
    const started = Date.now();
    while (Date.now() - started < POLL_LIMIT_MS) {
      await sleep(3000);
      const r = await fetch(`/api/devnet/receipt?sig=${sig}&user=${user}`, { cache: "no-store" });
      if (!r.ok) return;
      const receipt = (await r.json()) as Receipt;
      if (receipt.status === "finalized") {
        setPhase((p) => (p.kind === "landed" && p.sig === sig ? { kind: "landed", sig, receipt: { ...first, status: "finalized" } } : p));
        return;
      }
    }
  }

  return (
    <section className="panel fade-in p-4 sm:p-5" aria-label="Devnet wallet actions">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">Send a devnet transaction</h2>
        <div className="flex gap-1" role="group" aria-label="Action">
          {(Object.keys(ACTIONS) as DevnetAction[]).map((k) => (
            <button
              key={k}
              type="button"
              disabled={busy}
              onClick={() => {
                setAction(k);
                setPhase({ kind: "idle" });
              }}
              className={`btn px-3 py-1.5 text-xs ${action === k ? "btn-primary" : "btn-outline"}`}
            >
              {ACTIONS[k].label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-sm text-[var(--ink-2)]">{a.note}</p>

      <div className="mt-5 border-t border-[var(--line)] pt-4">
        <ConnectArea>
          {(wallet) => (
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <div>
                <label className="block">
                  <span className="text-sm text-[var(--ink-2)]">Amount of {a.spend} to spend</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    disabled={busy}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      if (!busy) setPhase({ kind: "idle" });
                    }}
                    placeholder="0.5"
                    className="mt-1 w-full px-3 py-2 text-base"
                  />
                </label>
                <button
                  type="button"
                  disabled={wallet.connected === null || raw === null || raw <= 0n || busy}
                  onClick={() => void run(wallet)}
                  className="btn btn-primary mt-3 w-full sm:w-auto"
                >
                  {phase.kind === "building"
                    ? "Building transaction..."
                    : phase.kind === "signing"
                      ? "Confirm in wallet..."
                      : phase.kind === "polling"
                        ? "Waiting for devnet..."
                        : `${a.label} on devnet`}
                </button>
                {wallet.connected !== null && (
                  <p className="mt-2 text-xs text-[var(--ink-3)]">Set your wallet to devnet. The transaction is sent to the devnet cluster.</p>
                )}

                {(phase.kind === "signing" || phase.kind === "polling") && (
                  <p className="mt-3 text-sm text-[var(--ink-2)]">
                    Expect <span className="mono text-[var(--ink)]">{formatAmount(BigInt(phase.expected), a.getDecimals, a.getDecimals)}</span> {a.get}. It
                    reverts below <span className="mono text-[var(--ink)]">{formatAmount(BigInt(phase.min), a.getDecimals, a.getDecimals)}</span>.
                  </p>
                )}
                {phase.kind === "polling" && (
                  <p className="mt-2 text-sm text-[var(--ink-2)]">
                    Sent <AddressLink value={phase.sig} kind="tx" cluster="devnet" />. Polling status,{" "}
                    <span className="mono">{Math.round(phase.waited / 1000)}s</span>.
                  </p>
                )}
                {phase.kind === "error" && (
                  <p className="mt-3 text-sm text-[var(--rejected)]">
                    {phase.message}
                    {phase.sig !== undefined && (
                      <>
                        {" "}
                        <AddressLink value={phase.sig} kind="tx" cluster="devnet" />
                      </>
                    )}
                  </p>
                )}
                {phase.kind === "landed" && (
                  <div className="mt-4" data-devnet-sig={phase.sig}>
                    <p className="text-sm">
                      <span className="stamp stamp-cleared">{phase.receipt.status}</span>{" "}
                      <span className="text-[var(--ink-2)]">in slot</span> <span className="mono">{phase.receipt.slot}</span>
                    </p>
                    <p className="mt-2 text-sm text-[var(--ink-2)]">
                      Signature <AddressLink value={phase.sig} kind="tx" cluster="devnet" />
                    </p>
                    <table className="mt-3 w-full text-left text-sm">
                      <thead className="mono text-[0.6875rem] uppercase tracking-widest text-[var(--ink-3)]">
                        <tr className="border-b border-[var(--line-strong)]">
                          <th className="py-1.5 font-normal">From the transaction</th>
                          <th className="py-1.5 text-right font-normal">Before</th>
                          <th className="py-1.5 text-right font-normal">After</th>
                          <th className="py-1.5 text-right font-normal">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ROWS.map((r) => {
                          const pre = phase.receipt.before[r.key];
                          const post = phase.receipt.after[r.key];
                          if (pre === null || post === null) {
                            return (
                              <tr key={r.key} className="border-b border-dashed border-[var(--line)]">
                                <td className="py-1.5 text-[var(--ink-2)]">{r.label}</td>
                                <td colSpan={3} className="py-1.5 text-right text-xs text-[var(--ink-3)]">
                                  not touched by this transaction
                                </td>
                              </tr>
                            );
                          }
                          const b = BigInt(pre);
                          const f = BigInt(post);
                          return (
                            <tr key={r.key} className="border-b border-dashed border-[var(--line)]">
                              <td className="py-1.5 text-[var(--ink-2)]">{r.label}</td>
                              <td className="mono py-1.5 text-right">{formatAmount(b, r.decimals, r.decimals)}</td>
                              <td className="mono py-1.5 text-right">{formatAmount(f, r.decimals, r.decimals)}</td>
                              <td className={`mono py-1.5 text-right ${f === b ? "text-[var(--ink-3)]" : "text-[var(--ink)]"}`}>
                                {f > b ? "+" : ""}
                                {formatAmount(f - b, r.decimals, r.decimals)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="mt-2 text-xs text-[var(--ink-3)]">
                      Pre and post balances from the transaction meta. Vault now{" "}
                      <span className="mono">{formatAmount(BigInt(phase.receipt.vaultBalance), 9, 9)}</span>, wrapped supply{" "}
                      <span className="mono">{formatAmount(BigInt(phase.receipt.wrappedSupply), 9, 9)}</span>.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <h3 className="mono text-[0.6875rem] uppercase tracking-widest text-[var(--ink-3)]">Your devnet holdings</h3>
                {wallet.connected === null ? (
                  <p className="mt-3 text-sm text-[var(--ink-3)]">Connect a wallet to read its devnet balances.</p>
                ) : (
                  <Ledger address={wallet.connected.address} refreshKey={refreshKey} />
                )}
              </div>
            </div>
          )}
        </ConnectArea>
      </div>
    </section>
  );
}
