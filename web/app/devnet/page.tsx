import { AddressLink } from "@/components/address-link";
import { DevnetPanel } from "@/components/devnet-panel";
import { PageHeader } from "@/components/page-header";
import { Stamp } from "@/components/stamp";
import { StatTile } from "@/components/stat-tile";
import { BASE_DECIMALS, DEVNET, REPLICA_DECIMALS, readDevnetState, type DevnetState } from "@/lib/devnet";
import { formatAmount } from "@/lib/format";

// Every figure on this page is an RPC read at request time.
export const dynamic = "force-dynamic";

function Invariant({ s }: { s: DevnetState }) {
  if (s.vaultBalance === s.wrappedSupply) return <Stamp variant="cleared">vault = supply</Stamp>;
  if (s.vaultBalance > s.wrappedSupply) return <Stamp variant="pending">over-backed</Stamp>;
  return <Stamp variant="rejected">under-backed</Stamp>;
}

export default async function DevnetPage() {
  let state: DevnetState | null = null;
  let error: string | null = null;
  try {
    state = await readDevnetState();
  } catch (err) {
    error = err instanceof Error ? err.message : "devnet read failed";
  }
  const fmt = (raw: bigint) => formatAmount(raw, REPLICA_DECIMALS, 9);

  return (
    <div className="space-y-10 py-10">
      <PageHeader
        no="06"
        eyebrow="Devnet, replica mint"
        title="The crossing, run live on devnet"
        lede={
          <>
            This page talks to the deployed Portage program on Solana devnet. tKalshi does not exist on devnet, so the
            underlying here is a Token-2022 replica with the same 20 bps transfer fee. Every figure below is read from
            the devnet RPC when the page loads, and every button sends a real devnet transaction from your wallet.
          </>
        }
        meta={[
          { label: "Cluster", value: "devnet" },
          { label: "Program", value: <AddressLink value={DEVNET.program.toBase58()} cluster="devnet" /> },
          { label: "Replica mint", value: <AddressLink value={DEVNET.replicaMint.toBase58()} cluster="devnet" /> },
          { label: "Wrapped mint", value: <AddressLink value={DEVNET.wrappedMint.toBase58()} cluster="devnet" /> },
          { label: "DBC pool", value: <AddressLink value={DEVNET.pool.toBase58()} cluster="devnet" /> },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Stamp variant="pending">Devnet &middot; replica mint</Stamp>
        <p className="text-sm text-[var(--ink-2)]">Not mainnet. No real tKalshi moves on this page.</p>
      </div>

      {error !== null || state === null ? (
        <section className="panel p-4 sm:p-5" aria-label="Devnet read failed">
          <Stamp variant="rejected">Read failed</Stamp>
          <p className="mt-3 text-sm text-[var(--rejected)]">{error}</p>
        </section>
      ) : (
        <>
          <section aria-label="Live devnet state" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Vault holds (replica)" value={fmt(state.vaultBalance)} sub="Token-2022 balance of the vault PDA" />
            <StatTile label="Wrapped supply" value={fmt(state.wrappedSupply)} sub="Legacy SPL mint, vault is the only authority" />
            <StatTile
              label="Pool reserves"
              value={`${formatAmount(state.poolQuoteReserve, REPLICA_DECIMALS, 4)} wt`}
              sub={`${formatAmount(state.poolBaseReserve, BASE_DECIMALS, 0)} PTGD left on the curve`}
            />
            <StatTile
              label="Program upgrade authority"
              value={state.upgradeAuthority === null ? "none" : state.upgradeAuthority.slice(0, 8)}
              tone={state.upgradeAuthority === null ? "accent" : "rejected"}
              sub={
                state.upgradeAuthority === null
                  ? `Immutable. Last deployed in slot ${state.programDataSlot}.`
                  : "Upgradeable: the authority can still change the program."
              }
            />
          </section>

          <section aria-label="Backing invariant" className="panel fade-in flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
            <div>
              <h2 className="text-lg">Backing invariant</h2>
              <p className="mt-1 text-sm text-[var(--ink-2)]">
                <span className="mono text-[var(--ink)]">{fmt(state.vaultBalance)}</span> replica in the vault against{" "}
                <span className="mono text-[var(--ink)]">{fmt(state.wrappedSupply)}</span> wrapped in circulation, read at slot{" "}
                <span className="mono">{state.slot}</span>.
              </p>
            </div>
            <Invariant s={state} />
          </section>
        </>
      )}

      <DevnetPanel />

      {state !== null && (
        <section aria-label="Recent devnet signatures" className="panel fade-in p-4 sm:p-5">
          <h2 className="text-lg">Recent signatures</h2>
          <p className="mt-1 text-sm text-[var(--ink-2)]">
            Newest first, from getSignaturesForAddress on the Portage program and the DBC pool.
          </p>
          {state.recent.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ink-3)]">No transactions have touched the program or pool yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="mono text-[0.6875rem] uppercase tracking-widest text-[var(--ink-3)]">
                  <tr className="border-b border-[var(--line-strong)]">
                    <th className="py-2 font-normal">Signature</th>
                    <th className="py-2 font-normal">Via</th>
                    <th className="py-2 font-normal">Slot</th>
                    <th className="py-2 font-normal">Time (UTC)</th>
                    <th className="py-2 text-right font-normal">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {state.recent.map((t) => (
                    <tr key={`${t.source}-${t.signature}`} className="border-b border-dashed border-[var(--line)]" data-sig={t.signature}>
                      <td className="py-2">
                        <AddressLink value={t.signature} kind="tx" cluster="devnet" />
                      </td>
                      <td className="py-2 text-[var(--ink-2)]">{t.source === "program" ? "Portage" : "DBC pool"}</td>
                      <td className="mono py-2">{t.slot}</td>
                      <td className="mono py-2 text-[var(--ink-2)]">
                        {t.blockTime === null ? "pending" : new Date(t.blockTime * 1000).toISOString().slice(0, 19).replace("T", " ")}
                      </td>
                      <td className={`mono py-2 text-right ${t.ok ? "text-[var(--accent)]" : "text-[var(--rejected)]"}`}>
                        {t.ok ? "ok" : "failed"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
