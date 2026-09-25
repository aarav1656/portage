// Devnet run against a Token-2022 replica of tKalshi. Never points at mainnet.
//   KEYPAIR=~/.config/solana/portage-devnet.json STATE=~/.config/solana/portage-devnet-state.json \
//   tsx src/devnet.ts raw-launch|init-vault|wrap|launch|buy|unwrap
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount,
} from "@solana/spl-token";
import { createRequire } from "node:module";
import { DynamicBondingCurveClient, TokenDecimal, deriveDbcPoolAddress } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { buildLaunchTx, tesseraMarkPrice } from "./index.js";
import { initVaultIx, userAccounts, vaultAddresses, wrapIx, unwrapIx } from "../../vault/src/index.js";

// bn.js is the SDK's own dependency; resolve it through the SDK instead of adding a direct dep.
const BN = createRequire(import.meta.resolve("@meteora-ag/dynamic-bonding-curve-sdk"))("bn.js");

const RPC = "https://api.devnet.solana.com";
const conn = new Connection(RPC, "confirmed");
const genesis = await conn.getGenesisHash();
if (genesis !== "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG") throw new Error(`not devnet: ${genesis}`);

const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.KEYPAIR!, "utf8"))));
const statePath = process.env.STATE!;
const state: Record<string, any> = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2));
const REPLICA = new PublicKey(state.replica ?? "EsnR4vxz8W2hR9BCQWjaVHMeWSCTB3Qazjc45WzKM9g2");
const UNIT = 1_000_000_000n;
const { wrappedMint, vaultToken } = vaultAddresses(REPLICA);
const user = userAccounts(payer.publicKey, REPLICA);

const bal = async (acct: PublicKey, program: PublicKey) => (await getAccount(conn, acct, "confirmed", program)).amount;

async function send(label: string, ixs: TransactionInstruction[] | Transaction, signers: Keypair[] = [], skipPreflight = false) {
  const tx = ixs instanceof Transaction ? ixs : new Transaction().add(...ixs);
  const sig = await sendAndConfirmTransaction(conn, tx, [payer, ...signers], { commitment: "confirmed", skipPreflight });
  console.log(`${label} sig ${sig}`);
  state[label] = { ...(state[label] ?? {}), sig };
  save();
  return sig;
}

async function launch(label: string, quoteMint: PublicKey, skipPreflight: boolean) {
  const config = Keypair.generate();
  const baseMint = Keypair.generate();
  const quoteUsd = process.env.QUOTE_USD ? Number(process.env.QUOTE_USD) : await tesseraMarkPrice("tKalshi");
  const tx = await buildLaunchTx(conn, {
    quoteMint,
    quoteDecimals: TokenDecimal.NINE,
    quoteUsd,
    startMarketCapUsd: 10_000,
    graduateMarketCapUsd: 100_000,
    config: config.publicKey,
    baseMint: baseMint.publicKey,
    partner: payer.publicKey,
    creator: payer.publicKey,
    payer: payer.publicKey,
    name: "Portage Devnet",
    symbol: "PTGD",
    uri: "https://example.org/ptgd.json",
  });
  const pool = deriveDbcPoolAddress(quoteMint, baseMint.publicKey, config.publicKey);
  state[label] = { config: config.publicKey.toBase58(), baseMint: baseMint.publicKey.toBase58(), pool: pool.toBase58(), quoteMint: quoteMint.toBase58(), quoteUsd };
  save();
  console.log(`${label} config ${config.publicKey.toBase58()} pool ${pool.toBase58()} tKalshi mark $${quoteUsd}`);
  return send(label, tx, [config, baseMint], skipPreflight);
}

const step = process.argv[2];
if (step === "raw-launch") {
  try {
    await launch("rawLaunch", REPLICA, true);
    console.log("rawLaunch UNEXPECTEDLY SUCCEEDED");
  } catch (e: any) {
    const sig = e.signature ?? e.message?.match(/Transaction ([1-9A-HJ-NP-Za-km-z]{80,90})/)?.[1];
    console.log(`rawLaunch failed: ${e.message}`);
    if (sig) {
      const t = await conn.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
      state.rawLaunch = { ...state.rawLaunch, sig, err: t?.meta?.err, logs: t?.meta?.logMessages?.filter((l) => /Error|failed/.test(l)) };
      save();
      console.log(JSON.stringify(state.rawLaunch, null, 2));
    }
  }
} else if (step === "init-vault") {
  await send("initVault", [initVaultIx(payer.publicKey, REPLICA)]);
} else if (step === "wrap") {
  const amount = 100n * UNIT;
  const minMinted = (amount * 9980n) / 10000n;
  const before = await bal(user.userUnderlying, TOKEN_2022_PROGRAM_ID);
  await send("wrap", [
    createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, user.userWrapped, payer.publicKey, wrappedMint, TOKEN_PROGRAM_ID),
    wrapIx(payer.publicKey, REPLICA, amount, minMinted),
  ]);
  const minted = await bal(user.userWrapped, TOKEN_PROGRAM_ID);
  const vault = await bal(vaultToken, TOKEN_2022_PROGRAM_ID);
  const after = await bal(user.userUnderlying, TOKEN_2022_PROGRAM_ID);
  Object.assign(state.wrap, { amount: `${amount}`, minMinted: `${minMinted}`, minted: `${minted}`, vaultBalance: `${vault}`, underlyingSpent: `${before - after}`, wrappedMint: wrappedMint.toBase58() });
  save();
  console.log(state.wrap);
} else if (step === "launch") {
  await launch("launch", wrappedMint, false);
} else if (step === "buy") {
  const client = new DynamicBondingCurveClient(conn, "confirmed");
  const pool = new PublicKey(state.launch.pool);
  const amountIn = new BN(`${1n * UNIT}`);
  const wBefore = await bal(user.userWrapped, TOKEN_PROGRAM_ID);
  const tx = await client.pool.swap({ owner: payer.publicKey, pool, amountIn, minimumAmountOut: new BN(1), swapBaseForQuote: false, referralTokenAccount: null });
  await send("buy", tx);
  const wAfter = await bal(user.userWrapped, TOKEN_PROGRAM_ID);
  const baseAta = PublicKey.findProgramAddressSync(
    [payer.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), new PublicKey(state.launch.baseMint).toBuffer()],
    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
  )[0];
  const baseOut = await bal(baseAta, TOKEN_PROGRAM_ID);
  Object.assign(state.buy, { quoteIn: `${wBefore - wAfter}`, baseOut: `${baseOut}` });
  save();
  console.log(state.buy);
} else if (step === "unwrap") {
  const amount = 10n * UNIT;
  const minOut = (amount * 9980n) / 10000n;
  const before = await bal(user.userUnderlying, TOKEN_2022_PROGRAM_ID);
  await send("unwrap", [unwrapIx(payer.publicKey, REPLICA, amount, minOut)]);
  const after = await bal(user.userUnderlying, TOKEN_2022_PROGRAM_ID);
  const vault = await bal(vaultToken, TOKEN_2022_PROGRAM_ID);
  const wrapped = await bal(user.userWrapped, TOKEN_PROGRAM_ID);
  Object.assign(state.unwrap, { amount: `${amount}`, minOut: `${minOut}`, received: `${after - before}`, vaultBalance: `${vault}`, wrappedLeft: `${wrapped}` });
  save();
  console.log(state.unwrap);
} else {
  throw new Error("usage: devnet.ts raw-launch|init-vault|wrap|launch|buy|unwrap");
}
process.exit(0);
