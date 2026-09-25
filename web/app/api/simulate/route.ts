import { NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { TokenDecimal } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { buildLaunchTx, tesseraMarkPrice } from "@portage/dbc";
import { connection } from "@/lib/rpc";

export const dynamic = "force-dynamic";

const TKALSHI = new PublicKey("TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ");
const STAND_IN = new PublicKey("J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn");
const SIM_PAYER = new PublicKey("5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9");

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const quote = searchParams.get("quote");
  if (quote !== "raw" && quote !== "plain") {
    return NextResponse.json({ error: "quote must be raw or plain" }, { status: 400 });
  }
  const quoteMint = quote === "raw" ? TKALSHI : STAND_IN;
  try {
    const conn: Connection = connection();
    const quoteUsd = await tesseraMarkPrice("tKalshi");
    const config = Keypair.generate().publicKey;
    const baseMint = Keypair.generate().publicKey;
    const tx = await buildLaunchTx(conn, {
      quoteMint,
      quoteDecimals: TokenDecimal.NINE,
      quoteUsd,
      startMarketCapUsd: 10_000,
      graduateMarketCapUsd: 100_000,
      config,
      baseMint,
      partner: SIM_PAYER,
      creator: SIM_PAYER,
      payer: SIM_PAYER,
      name: "Portage Test",
      symbol: "PTG",
      uri: "https://example.org/ptg.json",
    });
    const { blockhash } = await conn.getLatestBlockhash();
    const msg = new TransactionMessage({
      payerKey: SIM_PAYER,
      recentBlockhash: blockhash,
      instructions: tx.instructions,
    }).compileToV0Message();
    const vtx = new VersionedTransaction(msg);
    const sim = await conn.simulateTransaction(vtx, {
      sigVerify: false,
      replaceRecentBlockhash: true,
    });
    return NextResponse.json({
      quote,
      err: sim.value.err,
      logs: sim.value.logs ?? [],
      unitsConsumed: sim.value.unitsConsumed ?? null,
      simulatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "simulation failed";
    return NextResponse.json({ quote, error: message }, { status: 502 });
  }
}
