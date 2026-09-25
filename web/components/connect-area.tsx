"use client";
import { useWallet, type WalletState } from "@/lib/use-wallet";
import { shortAddress } from "@/lib/format";

/** Renders the connect controls and exposes wallet state to a parent via a render prop. */
export function ConnectArea({ children }: { children: (wallet: WalletState) => React.ReactNode }) {
  const wallet = useWallet();
  return (
    <div>
      {wallet.connected === null ? (
        <div className="flex flex-wrap items-center gap-2">
          {wallet.wallets.length === 0 ? (
            <p className="text-sm text-[var(--ink-2)]">
              No Solana wallet detected in this browser. Install Phantom, Solflare, or Backpack to continue.
            </p>
          ) : (
            wallet.wallets.map((w) => (
              <button
                key={w.name}
                type="button"
                onClick={() => void wallet.connect(w)}
                disabled={wallet.connecting}
                className="btn btn-outline"
              >
                {wallet.connecting ? "Connecting..." : `Connect ${w.name}`}
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="mono text-sm text-[var(--ink)]">
            {wallet.connected.name}: {shortAddress(wallet.connected.address)}
          </span>
          <button type="button" onClick={() => void wallet.disconnect()} className="btn btn-outline px-3 py-1.5 text-xs">
            Disconnect
          </button>
        </div>
      )}
      {wallet.error !== null && <p className="mt-2 text-sm text-[var(--rejected)]">{wallet.error}</p>}
      {children(wallet)}
    </div>
  );
}
