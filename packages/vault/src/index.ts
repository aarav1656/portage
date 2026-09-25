import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import idl from "./idl.json" with { type: "json" };

export { idl };
export const PORTAGE_PROGRAM_ID = new PublicKey(idl.address);

export function vaultAddresses(underlyingMint: PublicKey, programId = PORTAGE_PROGRAM_ID) {
  const pda = (seed: string) =>
    PublicKey.findProgramAddressSync([Buffer.from(seed), underlyingMint.toBuffer()], programId)[0];
  return { vault: pda("vault"), vaultToken: pda("vault_token"), wrappedMint: pda("wrapped") };
}

type IxName = "init_vault" | "wrap" | "unwrap";

function build(
  name: IxName,
  keys: Record<string, PublicKey>,
  args: bigint[],
  programId: PublicKey,
): TransactionInstruction {
  const def = idl.instructions.find((i) => i.name === name)!;
  const data = Buffer.alloc(8 + 8 * args.length);
  Buffer.from(def.discriminator).copy(data, 0);
  args.forEach((a, i) => data.writeBigUInt64LE(a, 8 + 8 * i));
  return new TransactionInstruction({
    programId,
    data,
    keys: def.accounts.map((a) => {
      const pubkey = keys[a.name];
      if (!pubkey) throw new Error(`portage ${name}: missing account ${a.name}`);
      return { pubkey, isSigner: !!a.signer, isWritable: !!a.writable };
    }),
  });
}

export function initVaultIx(payer: PublicKey, underlyingMint: PublicKey, programId = PORTAGE_PROGRAM_ID) {
  const v = vaultAddresses(underlyingMint, programId);
  return build(
    "init_vault",
    {
      payer,
      underlying_mint: underlyingMint,
      vault: v.vault,
      vault_token: v.vaultToken,
      wrapped_mint: v.wrappedMint,
      underlying_program: TOKEN_2022_PROGRAM_ID,
      token_program: TOKEN_PROGRAM_ID,
      system_program: SystemProgram.programId,
    },
    [],
    programId,
  );
}

/** User ATAs: underlying under Token-2022, wrapped under the legacy Token program. */
export function userAccounts(user: PublicKey, underlyingMint: PublicKey, programId = PORTAGE_PROGRAM_ID) {
  const { wrappedMint } = vaultAddresses(underlyingMint, programId);
  return {
    userUnderlying: getAssociatedTokenAddressSync(underlyingMint, user, true, TOKEN_2022_PROGRAM_ID),
    userWrapped: getAssociatedTokenAddressSync(wrappedMint, user, true, TOKEN_PROGRAM_ID),
  };
}

function moveIx(
  name: "wrap" | "unwrap",
  user: PublicKey,
  underlyingMint: PublicKey,
  amount: bigint,
  min: bigint,
  overrides: Record<string, PublicKey>,
  programId: PublicKey,
) {
  const v = vaultAddresses(underlyingMint, programId);
  const u = userAccounts(user, underlyingMint, programId);
  return build(
    name,
    {
      user,
      underlying_mint: underlyingMint,
      vault: v.vault,
      vault_token: v.vaultToken,
      wrapped_mint: v.wrappedMint,
      user_underlying: u.userUnderlying,
      user_wrapped: u.userWrapped,
      underlying_program: TOKEN_2022_PROGRAM_ID,
      token_program: TOKEN_PROGRAM_ID,
      ...overrides,
    },
    [amount, min],
    programId,
  );
}

/** `minMinted`: the transaction fails unless at least this many wrapped base units are minted. */
export const wrapIx = (
  user: PublicKey,
  underlyingMint: PublicKey,
  amount: bigint,
  minMinted: bigint,
  overrides: Record<string, PublicKey> = {},
  programId = PORTAGE_PROGRAM_ID,
) => moveIx("wrap", user, underlyingMint, amount, minMinted, overrides, programId);

/** `minOut`: the transaction fails unless the user receives at least this much underlying after the transfer fee. */
export const unwrapIx = (
  user: PublicKey,
  underlyingMint: PublicKey,
  amount: bigint,
  minOut: bigint,
  overrides: Record<string, PublicKey> = {},
  programId = PORTAGE_PROGRAM_ID,
) => moveIx("unwrap", user, underlyingMint, amount, minOut, overrides, programId);

export const PORTAGE_ERRORS = Object.fromEntries(idl.errors.map((e) => [e.name, e.code])) as Record<
  "UnsupportedUnderlying" | "NothingReceived" | "InvariantViolated" | "BelowMinimum",
  number
>;
