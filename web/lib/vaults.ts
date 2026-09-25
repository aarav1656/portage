import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getAccount, getMint } from "@solana/spl-token";
import { vaultAddresses } from "@portage/vault";
import { connection } from "@/lib/rpc";
import { TESSERA_TOKENS, type TesseraKey } from "@/lib/tessera";

export type VaultStatus =
  | { state: "not-initialised" }
  | { state: "ok"; vaultBalance: bigint; wrappedSupply: bigint; decimals: number; invariantHolds: boolean }
  | { state: "error"; message: string };

/** Reads the vault + wrapped-mint accounts for one underlying token, straight from the RPC. */
export async function fetchVaultStatus(key: TesseraKey): Promise<VaultStatus> {
  const conn = connection();
  const underlyingMint = TESSERA_TOKENS[key].mint;
  const { vaultToken, wrappedMint } = vaultAddresses(underlyingMint);
  try {
    const vaultTokenInfo = await conn.getAccountInfo(vaultToken);
    if (vaultTokenInfo === null) {
      return { state: "not-initialised" };
    }
    const [vaultAccount, wrappedMintInfo] = await Promise.all([
      getAccount(conn, vaultToken, "confirmed", TOKEN_2022_PROGRAM_ID),
      getMint(conn, wrappedMint, "confirmed", TOKEN_PROGRAM_ID),
    ]);
    return {
      state: "ok",
      vaultBalance: vaultAccount.amount,
      wrappedSupply: wrappedMintInfo.supply,
      decimals: wrappedMintInfo.decimals,
      invariantHolds: wrappedMintInfo.supply <= vaultAccount.amount,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to read vault accounts";
    return { state: "error", message };
  }
}
