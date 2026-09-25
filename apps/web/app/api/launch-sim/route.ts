import { NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { TokenDecimal } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { buildLaunchTx } from "@portage/dbc";
import { fetchMarketSnapshot } from "@/lib/market";
import { connection } from "@/lib/rpc";

export const dynamic = "force-dynamic";

const STAND_IN = new PublicKey("J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn");
const SIM_PAYER = new PublicKey("5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9");

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get("name") ?? "").trim();
  const symbol = (searchParams.get("symbol") ?? "").trim();
  const supplyRaw = searchParams.get("supply");
  const startMcapRaw = searchParams.get("startMcapUsd");

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!symbol) return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  const supply = Number(supplyRaw);
  if (!Number.isFinite(supply) || supply <= 0) {
    return NextResponse.json({ error: "supply must be a positive number" }, { status: 400 });
  }
  const startMcapUsd = Number(startMcapRaw);
  if (!Number.isFinite(startMcapUsd) || startMcapUsd <= 0) {
    return NextResponse.json({ error: "startMcapUsd must be a positive number" }, { status: 400 });
  }

  try {
    const conn: Connection = connection();
    const snapshot = await fetchMarketSnapshot();
    const tKalshi = snapshot.tKalshi;
    const quoteUsd = tKalshi.markPrice;
    if (!Number.isFinite(quoteUsd) || quoteUsd <= 0) {
      return NextResponse.json({ error: "live tKalshi mark price unavailable" }, { status: 502 });
    }

    const config = Keypair.generate().publicKey;
    const baseMint = Keypair.generate().publicKey;
    const tx = await buildLaunchTx(conn, {
      quoteMint: STAND_IN,
      quoteDecimals: TokenDecimal.NINE,
      quoteUsd,
      startMarketCapUsd: startMcapUsd,
      graduateMarketCapUsd: startMcapUsd * 10,
      config,
      baseMint,
      partner: SIM_PAYER,
      creator: SIM_PAYER,
      payer: SIM_PAYER,
      name: name.slice(0, 32),
      symbol: symbol.toUpperCase().slice(0, 10),
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

    const startPriceUsd = startMcapUsd / supply;
    return NextResponse.json({
      err: sim.value.err,
      logs: sim.value.logs ?? [],
      unitsConsumed: sim.value.unitsConsumed ?? null,
      startPriceUsd,
      anchor: {
        tesseraMarkPrice: tKalshi.markPrice,
        fetchedAt: tKalshi.asOf ?? new Date().toISOString(),
        stale: tKalshi.stale ?? false,
      },
      simulatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "launch simulation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
