import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { readReceipt } from "@/lib/devnet";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  const user = req.nextUrl.searchParams.get("user") ?? "";
  try {
    if (!/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig)) throw new Error("sig must be a base58 signature");
    const r = await readReceipt(sig, new PublicKey(user));
    return new NextResponse(JSON.stringify(r, (_, v) => (typeof v === "bigint" ? v.toString() : v)), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "failed to read receipt" }, { status: 400 });
  }
}
