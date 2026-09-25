// Real devnet wrap through the page's own builder (/api/devnet/tx), signed by the deployer key at
// PORTAGE_DEVNET_KEYPAIR, then chain-read assertions and the /devnet page must list the signature.
// EXPECT_FEE_BPS (default 20) is the fee the replica mint must charge; set it wrong to see this fail.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { withApp } from "./serve.mjs";
const require = createRequire(import.meta.url);
const { Connection, Keypair, PublicKey, Transaction } = require("@solana/web3.js");

const envFile = new URL("../.env", import.meta.url);
if (!process.env.PORTAGE_DEVNET_KEYPAIR && existsSync(envFile)) process.loadEnvFile(envFile);
const keyPath = process.env.PORTAGE_DEVNET_KEYPAIR;
if (!keyPath) throw new Error("PORTAGE_DEVNET_KEYPAIR is not set");
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(keyPath, "utf8"))));
const me = payer.publicKey.toBase58();

const REPLICA = "EsnR4vxz8W2hR9BCQWjaVHMeWSCTB3Qazjc45WzKM9g2";
const WRAPPED = "NrZEkPZmFwP6Ep9xy7gf7vtS9yVXecZAb3hxR7xoXfi";
const VAULT_TOKEN = PublicKey.findProgramAddressSync(
  [Buffer.from("vault_token"), new PublicKey(REPLICA).toBuffer()],
  new PublicKey("AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V"),
)[0];
const AMOUNT = 500_000_000n; // 0.5 replica
const FEE_BPS = BigInt(process.env.EXPECT_FEE_BPS ?? "20");
const expectedFee = (AMOUNT * FEE_BPS + 9_999n) / 10_000n;

const conn = new Connection("https://api.devnet.solana.com", "confirmed");
if ((await conn.getGenesisHash()) !== "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG") throw new Error("RPC is not devnet");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await withApp("@portage/web", 3171, async (get) => {
  const res = await get("/api/devnet/tx", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "wrap", user: me, amountRaw: AMOUNT.toString() }),
  });
  const built = await res.json();
  if (!built.txBase64) throw new Error(`/api/devnet/tx built nothing: ${JSON.stringify(built).slice(0, 200)}`);
  const tx = Transaction.from(Buffer.from(built.txBase64, "base64"));
  tx.partialSign(payer);
  const sig = await conn.sendRawTransaction(tx.serialize());
  console.log(`sent wrap ${AMOUNT} raw: ${sig}`);

  let status = null;
  for (let i = 0; i < 60 && !status; i++) {
    const s = (await conn.getSignatureStatuses([sig])).value[0];
    if (s?.err) throw new Error(`wrap failed on chain: ${JSON.stringify(s.err)}`);
    if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") status = s.confirmationStatus;
    else await sleep(1000);
  }
  if (!status) throw new Error("wrap not confirmed within 60s");

  const t = await conn.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  const bal = (list, mint, owner) => BigInt(list.find((b) => b.mint === mint && (owner ? b.owner === owner : b.owner !== me))?.uiTokenAmount.amount ?? "0");
  const deposited = bal(t.meta.preTokenBalances, REPLICA, me) - bal(t.meta.postTokenBalances, REPLICA, me);
  const minted = bal(t.meta.postTokenBalances, WRAPPED, me) - bal(t.meta.preTokenBalances, WRAPPED, me);
  const vaultIn = bal(t.meta.postTokenBalances, REPLICA) - bal(t.meta.preTokenBalances, REPLICA);
  const [vault, supply] = await Promise.all([
    conn.getTokenAccountBalance(VAULT_TOKEN),
    conn.getTokenSupply(new PublicKey(WRAPPED)),
  ]);
  console.log(`${status} slot ${t.slot}: deposited ${deposited}, minted ${minted}, vault +${vaultIn}, vault ${vault.value.amount}, supply ${supply.value.amount}`);
  if (deposited !== AMOUNT) throw new Error(`deposited ${deposited}, expected ${AMOUNT}`);
  if (minted !== AMOUNT - expectedFee) throw new Error(`minted ${minted}, expected ${AMOUNT - expectedFee} (${FEE_BPS} bps fee = ${expectedFee})`);
  if (vaultIn !== minted) throw new Error(`vault received ${vaultIn} but ${minted} was minted`);
  if (vault.value.amount !== supply.value.amount) throw new Error(`invariant broken: vault ${vault.value.amount} != supply ${supply.value.amount}`);

  let shown = false;
  for (let i = 0; i < 15 && !shown; i++) {
    shown = (await (await get("/devnet")).text()).includes(`data-sig="${sig}"`);
    if (!shown) await sleep(2000);
  }
  if (!shown) throw new Error(`/devnet does not list ${sig}`);
  console.log(`ok: real devnet wrap ${sig} minted ${minted} = ${AMOUNT} - ${expectedFee} (${FEE_BPS} bps), vault == supply, listed on /devnet`);
});
