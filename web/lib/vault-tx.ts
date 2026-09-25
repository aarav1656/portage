import { PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { unwrapIx, userAccounts, vaultAddresses, wrapIx } from "@portage/vault";
import { quoteMinimum, readLiveTransferFee } from "@/lib/fee";
import { connection } from "@/lib/rpc";
import { TESSERA_TOKENS, isTesseraKey } from "@/lib/tessera";

export interface WrapRequestBody {
  user?: unknown;
  token?: unknown;
  amountRaw?: unknown;
  minRaw?: unknown;
}

export interface ParsedWrapRequest {
  userKey: PublicKey;
  underlyingMint: PublicKey;
  amount: bigint;
  /** Caller's min_minted / min_out. Null: derive it from the live on-chain fee. */
  min: bigint | null;
}

/** Validates the shared {user, token, amountRaw, minRaw?} shape for /api/wrap and /api/unwrap. */
export function parseWrapRequest(body: WrapRequestBody): ParsedWrapRequest {
  const { user, token, amountRaw, minRaw } = body;
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
  let min: bigint | null = null;
  if (minRaw !== undefined) {
    if (typeof minRaw !== "string" || !/^\d+$/.test(minRaw)) throw new Error("minRaw must be a non-negative integer string");
    min = BigInt(minRaw);
    if (min > amount) throw new Error("minRaw cannot exceed amountRaw");
  }
  let userKey: PublicKey;
  try {
    userKey = new PublicKey(user);
  } catch {
    throw new Error("user must be a valid base58 public key");
  }
  return { userKey, underlyingMint: TESSERA_TOKENS[token].mint, amount, min };
}

async function resolveMin(req: ParsedWrapRequest): Promise<bigint> {
  if (req.min !== null) return req.min;
  return quoteMinimum(req.amount, await readLiveTransferFee(connection(), req.underlyingMint)).min;
}

export interface BuiltVaultTx {
  txBase64: string;
  minRaw: string;
}

async function serializeUnsigned(userKey: PublicKey, instructions: TransactionInstruction[]): Promise<string> {
  const conn = connection();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: userKey, blockhash, lastValidBlockHeight });
  tx.add(...instructions);
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
}

/** Deposit underlying (Token-2022) into the vault, minting wtKALSHI 1:1 net of the Tessera fee. */
export async function buildWrapTx(req: ParsedWrapRequest): Promise<BuiltVaultTx> {
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
  const min = await resolveMin(req);
  const ix = wrapIx(userKey, underlyingMint, amount, min);
  return { txBase64: await serializeUnsigned(userKey, [createWrappedAta, ix]), minRaw: min.toString() };
}

/** Burn wtKALSHI, redeeming the underlying Token-2022 back to the user 1:1. */
export async function buildUnwrapTx(req: ParsedWrapRequest): Promise<BuiltVaultTx> {
  const { userKey, underlyingMint, amount } = req;
  const { userUnderlying } = userAccounts(userKey, underlyingMint);
  const createUnderlyingAta = createAssociatedTokenAccountIdempotentInstruction(
    userKey,
    userUnderlying,
    userKey,
    underlyingMint,
    TOKEN_2022_PROGRAM_ID,
  );
  const min = await resolveMin(req);
  const ix = unwrapIx(userKey, underlyingMint, amount, min);
  return { txBase64: await serializeUnsigned(userKey, [createUnderlyingAta, ix]), minRaw: min.toString() };
}
