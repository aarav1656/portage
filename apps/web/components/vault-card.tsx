import { AddressLink } from "@/components/address-link";
import { Stamp } from "@/components/stamp";
import { formatAmount } from "@/lib/format";
import type { VaultStatus } from "@/lib/vaults";

export function VaultCard({
  label,
  underlyingMint,
  vaultTokenAddr,
  wrappedMintAddr,
  status,
}: {
  label: string;
  underlyingMint: string;
  vaultTokenAddr: string;
  wrappedMintAddr: string;
  status: VaultStatus;
}) {
  return (
    <section className="panel fade-in p-4 sm:p-5" aria-label={`${label} vault`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">{label}</h2>
        {status.state === "not-initialised" && <Stamp variant="pending">Not initialised</Stamp>}
        {status.state === "ok" && <Stamp variant={status.invariantHolds ? "cleared" : "rejected"}>{status.invariantHolds ? "Cleared" : "Invariant broken"}</Stamp>}
        {status.state === "error" && <Stamp variant="rejected">Read failed</Stamp>}
      </div>

      <dl className="mt-3">
        <div className="ledger-row">
          <dt className="text-sm text-[var(--ink-2)]">Underlying mint</dt>
          <dd>
            <AddressLink value={underlyingMint} />
          </dd>
        </div>
        <div className="ledger-row">
          <dt className="text-sm text-[var(--ink-2)]">Vault token account</dt>
          <dd>
            <AddressLink value={vaultTokenAddr} />
          </dd>
        </div>
        <div className="ledger-row">
          <dt className="text-sm text-[var(--ink-2)]">Wrapped mint</dt>
          <dd>
            <AddressLink value={wrappedMintAddr} />
          </dd>
        </div>

        {status.state === "not-initialised" && (
          <p className="mt-3 text-sm text-[var(--ink-3)]">
            The Portage program has not deployed this vault yet. There is nothing on chain to read.
          </p>
        )}

        {status.state === "error" && <p className="mt-3 text-sm text-[var(--rejected)]">{status.message}</p>}

        {status.state === "ok" && (
          <>
            <div className="ledger-row">
              <dt className="text-sm text-[var(--ink-2)]">Vault balance</dt>
              <dd className="mono text-sm text-[var(--ink)]">{formatAmount(status.vaultBalance, status.decimals)}</dd>
            </div>
            <div className="ledger-row">
              <dt className="text-sm text-[var(--ink-2)]">Wrapped supply</dt>
              <dd className="mono text-sm text-[var(--ink)]">{formatAmount(status.wrappedSupply, status.decimals)}</dd>
            </div>
            <div className="ledger-row">
              <dt className="text-sm text-[var(--ink-2)]">Invariant: wrapped supply &le; vault balance</dt>
              <dd className={`mono text-sm ${status.invariantHolds ? "text-[var(--accent)]" : "text-[var(--rejected)]"}`}>
                {status.invariantHolds ? "pass" : "fail"}
              </dd>
            </div>
          </>
        )}
      </dl>
    </section>
  );
}
