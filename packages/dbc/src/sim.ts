// Mainnet dry run: simulateTransaction with sigVerify off. Nothing is signed or sent.
//   tsx src/sim.ts green   quote = JitoSOL, a live legacy SPL mint with 9 decimals and no extensions (the wtKALSHI shape)
//   tsx src/sim.ts red     quote = raw tKalshi (Token-2022, live 20 bps transfer fee)
import { Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { TokenDecimal } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { buildLaunchTx, tesseraMarkPrice } from "./index.js";

// The SDK reads the quote mint on-chain, so the stand-in must already exist; wtKALSHI is not deployed yet.
const STAND_IN = new PublicKey("J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn");
const TKALSHI = new PublicKey("TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ");
const mode = process.argv[2];
if (mode !== "green" && mode !== "red") throw new Error("usage: sim.ts green|red");

const conn = new Connection(process.env.RPC_URL ?? "https://api.mainnet-beta.solana.com", "confirmed");
// Any funded mainnet address works as the simulated fee payer since signatures are not verified.
const payer = new PublicKey(process.env.SIM_PAYER ?? "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9");

const quoteUsd = await tesseraMarkPrice("tKalshi");
const config = Keypair.generate().publicKey;
const baseMint = Keypair.generate().publicKey;
const quoteMint = mode === "green" ? STAND_IN : TKALSHI;

const tx = await buildLaunchTx(conn, {
  quoteMint,
  quoteDecimals: TokenDecimal.NINE,
  quoteUsd,
  startMarketCapUsd: 10_000,
  graduateMarketCapUsd: 100_000,
  config,
  baseMint,
  partner: payer,
  creator: payer,
  payer,
  name: "Portage Test",
  symbol: "PTG",
  uri: "https://example.org/ptg.json",
});

const { blockhash } = await conn.getLatestBlockhash();
const msg = new TransactionMessage({
  payerKey: payer,
  recentBlockhash: blockhash,
  instructions: tx.instructions,
}).compileToV0Message();
const vtx = new VersionedTransaction(msg);
const before = await conn.getBalance(payer);
const sim = await conn.simulateTransaction(vtx, {
  sigVerify: false,
  replaceRecentBlockhash: true,
  accounts: { encoding: "base64", addresses: [payer.toBase58()] },
});

console.log(`mode ${mode} quote ${quoteMint.toBase58()} tKalshi mark $${quoteUsd}`);
console.log(`slot ${sim.context.slot} err ${JSON.stringify(sim.value.err)} CU ${sim.value.unitsConsumed} ixs ${msg.compiledInstructions.length} bytes ${vtx.serialize().length}`);
const after = sim.value.accounts?.[0]?.lamports;
if (after !== undefined) console.log(`payer lamport delta ${(before - after) / 1e9} SOL`);
for (const l of sim.value.logs ?? []) {
  if (/Instruction: |Error|failed|consumed .* of/.test(l) && !/Program log: Instruction: (InitializeMint2|InitializeAccount3|GetAccountDataSize|InitializeImmutableOwner)/.test(l)) console.log("  " + l);
}
process.exit(0);
