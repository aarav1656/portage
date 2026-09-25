"use client";
import { usePathname } from "next/navigation";
import { AddressLink } from "@/components/address-link";

/** Ft-minimal: one hairline-topped strip, program id + network, no link columns, no social row. */
export function SiteFooter({ programId }: { programId: string }): React.ReactNode {
  const devnet = usePathname() === "/devnet";
  return (
    <footer className="border-t border-[var(--line)]">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6 lg:px-10">
        <p className="mono text-xs text-[var(--ink-3)]">
          Portage program{" "}
          <span className="text-[var(--ink)]">
            <AddressLink value={programId} cluster={devnet ? "devnet" : undefined} />
          </span>
        </p>
        <p className="mono text-xs uppercase tracking-widest text-[var(--ink-3)]">{devnet ? "Solana devnet" : "Solana mainnet-beta"}</p>
      </div>
    </footer>
  );
}
