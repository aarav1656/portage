import { vaultAddresses } from "@portage/vault";
import { VaultCard } from "@/components/vault-card";
import { TESSERA_TOKENS, type TesseraKey } from "@/lib/tessera";
import { fetchVaultStatus } from "@/lib/vaults";

// Reads live vault/mint accounts over RPC on every request; must never be statically cached.
export const dynamic = "force-dynamic";

export default async function VaultsPage() {
  const keys = Object.keys(TESSERA_TOKENS) as TesseraKey[];
  const statuses = await Promise.all(keys.map((key) => fetchVaultStatus(key)));

  return (
    <div className="space-y-10 py-10">
      <section className="fade-in">
        <p className="mono text-xs uppercase tracking-widest text-[var(--ink-3)]">Warehouse ledger</p>
        <h1 className="mt-2 text-4xl leading-tight sm:text-5xl">Bonded vaults, per underlying</h1>
        <p className="mt-4 max-w-2xl text-base text-[var(--ink-2)]">
          Each vault must hold at least as much of the Tessera token as wtKALSHI is in circulation. The check below is
          read live from the vault token account and the wrapped mint&apos;s supply, not computed off-chain.
        </p>
      </section>

      <div className="space-y-6">
        {keys.map((key, i) => {
          const t = TESSERA_TOKENS[key];
          const { vaultToken, wrappedMint } = vaultAddresses(t.mint);
          return (
            <VaultCard
              key={key}
              label={t.label}
              underlyingMint={t.mint.toBase58()}
              vaultTokenAddr={vaultToken.toBase58()}
              wrappedMintAddr={wrappedMint.toBase58()}
              status={statuses[i]!}
            />
          );
        })}
      </div>
    </div>
  );
}
