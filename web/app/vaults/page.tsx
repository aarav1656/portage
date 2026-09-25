import { vaultAddresses } from "@portage/vault";
import { VaultCard } from "@/components/vault-card";
import { PageHeader } from "@/components/page-header";
import { TESSERA_TOKENS, type TesseraKey } from "@/lib/tessera";
import { fetchVaultStatus } from "@/lib/vaults";

// Reads live vault/mint accounts over RPC on every request; must never be statically cached.
export const dynamic = "force-dynamic";

export default async function VaultsPage() {
  const keys = Object.keys(TESSERA_TOKENS) as TesseraKey[];
  const statuses = await Promise.all(keys.map((key) => fetchVaultStatus(key)));

  return (
    <div className="space-y-10 py-10">
      <PageHeader
        no="05"
        eyebrow="Warehouse ledger"
        title="Bonded vaults, per underlying"
        lede={
          <>
            Each vault must hold at least as much of the Tessera token as wtKALSHI is in circulation. The check below is
            read live from the vault token account and the wrapped mint&apos;s supply, not computed off-chain.
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
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
