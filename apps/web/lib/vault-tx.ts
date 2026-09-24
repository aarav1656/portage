import { PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { unwrapIx, userAccounts, vaultAddresses, wrapIx } from "@portage/vault";
import { connection } from "@/lib/rpc";
import { TESSERA_TOKENS, isTesseraKey } from "@/lib/tessera";

export interface WrapRequestBody {
  user?: unknown;
  token?: unknown;
  amountRaw?: unknown;
}

export interface ParsedWrapRequest {
  userKey: PublicKey;
  underlyingMint: PublicKey;
  amount: bigint;
}

/** Validates the shared {user, token, amountRaw} shape for /api/wrap and /api/unwrap. */
export function parseWrapRequest(body: WrapRequestBody): ParsedWrapRequest {
  const { user, token, amountRaw } = body;
  if (typeof user !== "string" || typeof token !== "string" || typeof amountRaw !== "string") {
    throw new Error("user, token and amountRaw are required strings");
  }
  if (!isTesseraKey(token)) {
    throw new Error(`unsupported token "${token}", expected "Kalshi" or "OpenAI"`);
  }
  let amount: bigint;
  try {
    amount = BigInt(amountRaw);
  } catch {
    throw new Error("amountRaw must be an integer string");
  }
  if (amount <= 0n) throw new Error("amountRaw must be positive");
  let userKey: PublicKey;
  try {
    userKey = new PublicKey(user);
  } catch {
    throw new Error("user must be a valid base58 public key");
  }
  return { userKey, underlyingMint: TESSERA_TOKENS[token].mint, amount };
}

async function serializeUnsigned(userKey: PublicKey, instructions: TransactionInstruction[]): Promise<string> {
  const conn = connection();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: userKey, blockhash, lastValidBlockHeight });
  tx.add(...instructions);
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
}

/** Deposit underlying (Token-2022) into the vault, minting wtKALSHI 1:1 net of the Tessera fee. */
export async function buildWrapTx(req: ParsedWrapRequest): Promise<string> {
  const { userKey, underlyingMint, amount } = req;
  const { wrappedMint } = vaultAddresses(underlyingMint);
  const { userWrapped } = userAccounts(userKey, underlyingMint);
  const createWrappedAta = createAssociatedTokenAccountIdempotentInstruction(
    userKey,
    userWrapped,
    userKey,
    wrappedMint,
    TOKEN_PROGRAM_ID,
  );
  const ix = wrapIx(userKey, underlyingMint, amount);
  return serializeUnsigned(userKey, [createWrappedAta, ix]);
}

/** Burn wtKALSHI, redeeming the underlying Token-2022 back to the user 1:1. */
export async function buildUnwrapTx(req: ParsedWrapRequest): Promise<string> {
  const { userKey, underlyingMint, amount } = req;
  const { userUnderlying } = userAccounts(userKey, underlyingMint);
  const createUnderlyingAta = createAssociatedTokenAccountIdempotentInstruction(
    userKey,
    userUnderlying,
    userKey,
    underlyingMint,
    TOKEN_2022_PROGRAM_ID,
  );
  const ix = unwrapIx(userKey, underlyingMint, amount);
  return serializeUnsigned(userKey, [createUnderlyingAta, ix]);
}
