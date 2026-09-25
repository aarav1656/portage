// Operator script: fund a browser wallet for the devnet demo from the deployer key.
//   pnpm --filter @portage/dbc fund-devnet <wallet> [sol=0.5] [replica=10]
// Sends devnet SOL and mints replica tKalshi (the deployer is the replica mint authority).
// Reads PORTAGE_DEVNET_KEYPAIR (a file path) from the environment or the repo .env. Refuses to run off devnet.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const REPLICA = new PublicKey("EsnR4vxz8W2hR9BCQWjaVHMeWSCTB3Qazjc45WzKM9g2");
const DECIMALS = 9;

const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (!process.env.PORTAGE_DEVNET_KEYPAIR && existsSync(envFile)) process.loadEnvFile(envFile);
const keyPath = process.env.PORTAGE_DEVNET_KEYPAIR;
if (!keyPath) throw new Error("PORTAGE_DEVNET_KEYPAIR is not set (path to the deployer keypair file)");

const [target, solArg = "0.5", replicaArg = "10"] = process.argv.slice(2);
if (!target) throw new Error("usage: fund-devnet <wallet> [sol] [replica]");
const wallet = new PublicKey(target);
const toUnits = (v: string, decimals: number) => {
  if (!/^\d+(\.\d+)?$/.test(v)) throw new Error(`not a positive decimal: ${v}`);
  const [w, f = ""] = v.split(".");
  if (f.length > decimals) throw new Error(`${v} has more than ${decimals} decimals`);
  return BigInt(w + f.padEnd(decimals, "0"));
};
const lamports = toUnits(solArg, 9);
const replicaRaw = toUnits(replicaArg, DECIMALS);

const conn = new Connection(process.env.DEVNET_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
const genesis = await conn.getGenesisHash();
if (genesis !== DEVNET_GENESIS) throw new Error(`not devnet: ${genesis}`);

const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(keyPath, "utf8"))));
const ata = getAssociatedTokenAddressSync(REPLICA, wallet, true, TOKEN_2022_PROGRAM_ID);
const replicaOf = async () => {
  try {
    return (await getAccount(conn, ata, "confirmed", TOKEN_2022_PROGRAM_ID)).amount;
  } catch {
    return 0n;
  }
};
const [solBefore, replicaBefore] = [BigInt(await conn.getBalance(wallet, "confirmed")), await replicaOf()];

const tx = new Transaction();
if (lamports > 0n) tx.add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: wallet, lamports }));
tx.add(createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, wallet, REPLICA, TOKEN_2022_PROGRAM_ID));
if (replicaRaw > 0n) {
  tx.add(createMintToCheckedInstruction(REPLICA, ata, payer.publicKey, replicaRaw, DECIMALS, [], TOKEN_2022_PROGRAM_ID));
}
const sig = await sendAndConfirmTransaction(conn, tx, [payer], { commitment: "confirmed" });

const [solAfter, replicaAfter] = [BigInt(await conn.getBalance(wallet, "confirmed")), await replicaOf()];
if (solAfter - solBefore !== lamports) throw new Error(`SOL moved ${solAfter - solBefore}, expected ${lamports}`);
if (replicaAfter - replicaBefore !== replicaRaw) throw new Error(`replica moved ${replicaAfter - replicaBefore}, expected ${replicaRaw}`);
const fmt = (raw: bigint, d: number) => (Number(raw) / 10 ** d).toFixed(d === 9 ? 4 : d);
console.log(`funded ${wallet.toBase58()} on devnet`);
console.log(`  SOL      ${fmt(solBefore, 9)} -> ${fmt(solAfter, 9)}`);
console.log(`  replica  ${fmt(replicaBefore, DECIMALS)} -> ${fmt(replicaAfter, DECIMALS)}`);
console.log(`  sig      ${sig}`);
console.log(`  https://explorer.solana.com/tx/${sig}?cluster=devnet`);
