import { NextRequest, NextResponse } from "next/server";
import { devnetConnection } from "@/lib/devnet";

export const dynamic = "force-dynamic";

// Wallets like Jupiter broadcast signAndSend through their own mainnet endpoint and ignore the
// requested chain, so /devnet asks the wallet only to sign and relays the signed bytes here.
export async function POST(req: NextRequest) {
  try {
    const { tx } = (await req.json()) as { tx?: unknown };
    if (typeof tx !== "string" || tx.length === 0 || tx.length > 2000) throw new Error("tx must be a base64 signed transaction");
    const raw = Buffer.from(tx, "base64");
    const signature = await devnetConnection().sendRawTransaction(raw, { skipPreflight: false, maxRetries: 5 });
    return NextResponse.json({ signature }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "send failed" }, { status: 400 });
  }
}
