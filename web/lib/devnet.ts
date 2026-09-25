import { Connection, PublicKey, Transaction, type TransactionInstruction } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  getMint,
  unpackAccount,
} from "@solana/spl-token";
import BN from "bn.js";
import { DynamicBondingCurveClient, getCurrentPoint } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { PORTAGE_PROGRAM_ID, unwrapIx, userAccounts, vaultAddresses, wrapIx } from "@portage/vault";
import { quoteMinimum, readLiveTransferFee } from "@/lib/fee";

/** The devnet run recorded in DEVNET.md. Replica mint, not the real tKalshi. */
export const DEVNET = {
  replicaMint: new PublicKey("EsnR4vxz8W2hR9BCQWjaVHMeWSCTB3Qazjc45WzKM9g2"),
  pool: new PublicKey("8GN2C1Ryn5hjLzAs9ncpYbNyXd63rynhv4E1KZRHpQ1Q"),
  baseMint: new PublicKey("BLJgR2DnMbE3SF3B2QQqRMzDRmoHay2a9YnyiqdFUw55"),
  program: PORTAGE_PROGRAM_ID,
  ...vaultAddresses(new PublicKey("EsnR4vxz8W2hR9BCQWjaVHMeWSCTB3Qazjc45WzKM9g2")),
};
export const REPLICA_DECIMALS = 9;
export const BASE_DECIMALS = 6;
const BPF_UPGRADEABLE_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");
const BUY_SLIPPAGE_BPS = 100;

export function devnetConnection(): Connection {
  return new Connection(process.env.DEVNET_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
}

export interface RecentTx {
  signature: string;
  slot: number;
  blockTime: number | null;
  ok: boolean;
  source: "program" | "pool";
}

export interface DevnetState {
  vaultBalance: bigint;
  wrappedSupply: bigint;
  poolBaseReserve: bigint;
  poolQuoteReserve: bigint;
  upgradeAuthority: string | null;
  programDataSlot: bigint;
  recent: RecentTx[];
  slot: number;
}

/** Upgrade authority of an upgradeable-loader program, read from its ProgramData account. */
async function readUpgradeAuthority(conn: Connection) {
  const program = await conn.getAccountInfo(DEVNET.program);
  if (program === null || !program.owner.equals(BPF_UPGRADEABLE_LOADER)) throw new Error("Portage program account not found on devnet");
  const programData = new PublicKey(program.data.subarray(4, 36));
  const pd = await conn.getAccountInfo(programData, { dataSlice: { offset: 0, length: 45 } });
  if (pd === null) throw new Error("ProgramData account missing");
  // ProgramData layout: u32 tag, u64 slot, Option<Pubkey> authority.
  return {
    slot: pd.data.readBigUInt64LE(4),
    authority: pd.data[12] === 1 ? new PublicKey(pd.data.subarray(13, 45)).toBase58() : null,
  };
}

export async function readDevnetState(): Promise<DevnetState> {
  const conn = devnetConnection();
  const client = new DynamicBondingCurveClient(conn, "confirmed");
  const [vaultToken, wrapped, pool, upgrade, programSigs, poolSigs, slot] = await Promise.all([
    conn.getAccountInfo(DEVNET.vaultToken),
    getMint(conn, DEVNET.wrappedMint, "confirmed", TOKEN_PROGRAM_ID),
    client.state.getPool(DEVNET.pool),
    readUpgradeAuthority(conn),
    conn.getSignaturesForAddress(DEVNET.program, { limit: 12 }),
    conn.getSignaturesForAddress(DEVNET.pool, { limit: 6 }),
    conn.getSlot("confirmed"),
  ]);
  if (vaultToken === null) throw new Error("vault token account not found on devnet");
  if (pool === null) throw new Error("DBC pool not found on devnet");
  const tag = (source: RecentTx["source"]) => (s: (typeof programSigs)[number]): RecentTx => ({
    signature: s.signature,
    slot: s.slot,
    blockTime: s.blockTime ?? null,
    ok: s.err === null,
    source,
  });
  const recent = [...programSigs.map(tag("program")), ...poolSigs.map(tag("pool"))]
    .sort((a, b) => b.slot - a.slot)
    .slice(0, 14);
  return {
    vaultBalance: unpackAccount(DEVNET.vaultToken, vaultToken, TOKEN_2022_PROGRAM_ID).amount,
    wrappedSupply: wrapped.supply,
    poolBaseReserve: BigInt(pool.poolState.baseReserve.toString()),
    poolQuoteReserve: BigInt(pool.poolState.quoteReserve.toString()),
    upgradeAuthority: upgrade.authority,
    programDataSlot: upgrade.slot,
    recent,
    slot,
  };
}

export type DevnetAction = "wrap" | "unwrap" | "buy";

export interface BuiltDevnetTx {
  txBase64: string;
  /** min_minted for wrap, min_out for unwrap, minimum base out for buy. */
  minRaw: string;
  /** Expected amount credited to the user, before slippage headroom. */
  expectedRaw: string;
}

async function serialize(conn: Connection, user: PublicKey, tx: Transaction): Promise<string> {
  // Finalized, so a wallet that preflights at the default (finalized) commitment still knows the blockhash.
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("finalized");
  tx.feePayer = user;
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
}

/** Unsigned devnet transaction for one action. The same builder serves the page and check-devnet.mjs. */
export async function buildDevnetTx(action: DevnetAction, user: PublicKey, amount: bigint): Promise<BuiltDevnetTx> {
  if (amount <= 0n) throw new Error("amount must be positive");
  const conn = devnetConnection();
  const u = userAccounts(user, DEVNET.replicaMint);

  if (action === "buy") {
    const client = new DynamicBondingCurveClient(conn, "confirmed");
    const pool = await client.state.getPool(DEVNET.pool);
    if (pool === null) throw new Error("DBC pool not found on devnet");
    const config = await client.state.getPoolConfig(pool.poolState.config);
    if (config === null) throw new Error("DBC pool config not found on devnet");
    const quote = client.pool.swapQuote({
      virtualPool: pool,
      config,
      swapBaseForQuote: false,
      amountIn: new BN(amount.toString()),
      slippageBps: BUY_SLIPPAGE_BPS,
      hasReferral: false,
      eligibleForFirstSwapWithMinFee: false,
      currentPoint: await getCurrentPoint(conn, config.activationType),
    });
    const tx = await client.pool.swap({
      owner: user,
      pool: DEVNET.pool,
      amountIn: new BN(amount.toString()),
      minimumAmountOut: quote.minimumAmountOut,
      swapBaseForQuote: false,
      referralTokenAccount: null,
    });
    return {
      txBase64: await serialize(conn, user, tx),
      minRaw: quote.minimumAmountOut.toString(),
      expectedRaw: quote.outputAmount.toString(),
    };
  }

  const { received, min } = quoteMinimum(amount, await readLiveTransferFee(conn, DEVNET.replicaMint));
  const ixs: TransactionInstruction[] =
    action === "wrap"
      ? [
          createAssociatedTokenAccountIdempotentInstruction(user, u.userWrapped, user, DEVNET.wrappedMint, TOKEN_PROGRAM_ID),
          wrapIx(user, DEVNET.replicaMint, amount, min),
        ]
      : [
          createAssociatedTokenAccountIdempotentInstruction(user, u.userUnderlying, user, DEVNET.replicaMint, TOKEN_2022_PROGRAM_ID),
          unwrapIx(user, DEVNET.replicaMint, amount, min),
        ];
  return {
    txBase64: await serialize(conn, user, new Transaction().add(...ixs)),
    minRaw: min.toString(),
    expectedRaw: received.toString(),
  };
}

export interface Holdings {
  sol: bigint;
  replica: bigint;
  wrapped: bigint;
  base: bigint;
}

export function holdingAccounts(user: PublicKey) {
  const u = userAccounts(user, DEVNET.replicaMint);
  return {
    replica: u.userUnderlying,
    wrapped: u.userWrapped,
    base: getAssociatedTokenAddressSync(DEVNET.baseMint, user, true, TOKEN_PROGRAM_ID),
  };
}

export async function readHoldings(user: PublicKey): Promise<Holdings> {
  const conn = devnetConnection();
  const a = holdingAccounts(user);
  const [sol, infos] = await Promise.all([
    conn.getBalance(user, "confirmed"),
    conn.getMultipleAccountsInfo([a.replica, a.wrapped, a.base], "confirmed"),
  ]);
  const amt = (i: number, addr: PublicKey) => {
    const info = infos[i];
    return info ? unpackAccount(addr, info, info.owner).amount : 0n;
  };
  return { sol: BigInt(sol), replica: amt(0, a.replica), wrapped: amt(1, a.wrapped), base: amt(2, a.base) };
}

export type TxHoldings = { [K in keyof Holdings]: K extends "sol" ? bigint : bigint | null };

export type Receipt =
  | { status: "pending" }
  | { status: "failed"; err: string; slot: number }
  | {
      status: "confirmed" | "finalized";
      slot: number;
      /** Null: the transaction did not touch that token account. */
      before: TxHoldings;
      after: TxHoldings;
      vaultBalance: string;
      wrappedSupply: string;
    };

/** Status of a signature and, once confirmed, the user's balances before and after that exact transaction. */
export async function readReceipt(signature: string, user: PublicKey): Promise<Receipt> {
  const conn = devnetConnection();
  const { value } = await conn.getSignatureStatuses([signature], { searchTransactionHistory: true });
  const st = value[0];
  if (!st || st.confirmationStatus === "processed" || st.confirmationStatus === undefined) return { status: "pending" };
  if (st.err !== null) return { status: "failed", err: JSON.stringify(st.err), slot: st.slot };
  const tx = await conn.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  if (tx === null || tx.meta === null) return { status: "pending" };
  const keys = tx.transaction.message.getAccountKeys().staticAccountKeys;
  const userIndex = keys.findIndex((k) => k.equals(user));
  if (userIndex < 0) throw new Error("this transaction does not involve the connected wallet");
  const meta = tx.meta;
  const find = (list: typeof meta.preTokenBalances, mint: PublicKey) =>
    list?.find((b) => b.owner === user.toBase58() && b.mint === mint.toBase58())?.uiTokenAmount.amount;
  // Absent from both sides: untouched. Absent from one side only: the account was created or closed here.
  const token = (list: typeof meta.preTokenBalances, mint: PublicKey) =>
    find(meta.preTokenBalances, mint) === undefined && find(meta.postTokenBalances, mint) === undefined
      ? null
      : BigInt(find(list, mint) ?? "0");
  const side = (lamports: number[], list: typeof meta.preTokenBalances): TxHoldings => ({
    sol: BigInt(lamports[userIndex] ?? 0),
    replica: token(list, DEVNET.replicaMint),
    wrapped: token(list, DEVNET.wrappedMint),
    base: token(list, DEVNET.baseMint),
  });
  const [vault, wrapped] = await Promise.all([
    conn.getTokenAccountBalance(DEVNET.vaultToken, "confirmed"),
    getMint(conn, DEVNET.wrappedMint, "confirmed", TOKEN_PROGRAM_ID),
  ]);
  return {
    status: st.confirmationStatus,
    slot: tx.slot,
    before: side(tx.meta.preBalances, tx.meta.preTokenBalances),
    after: side(tx.meta.postBalances, tx.meta.postTokenBalances),
    vaultBalance: vault.value.amount,
    wrappedSupply: wrapped.supply.toString(),
  };
}
