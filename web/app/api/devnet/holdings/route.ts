import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { readHoldings } from "@/lib/devnet";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const h = await readHoldings(new PublicKey(req.nextUrl.searchParams.get("user") ?? ""));
    return NextResponse.json(Object.fromEntries(Object.entries(h).map(([k, v]) => [k, v.toString()])));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "failed to read holdings" }, { status: 400 });
  }
}
