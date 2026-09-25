import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { buildDevnetTx, type DevnetAction } from "@/lib/devnet";

export const dynamic = "force-dynamic";

const ACTIONS: DevnetAction[] = ["wrap", "unwrap", "buy"];

export async function POST(req: NextRequest) {
  try {
    const { action, user, amountRaw } = (await req.json()) as Record<string, unknown>;
    if (typeof action !== "string" || !ACTIONS.includes(action as DevnetAction)) throw new Error("action must be wrap, unwrap or buy");
    if (typeof user !== "string" || typeof amountRaw !== "string" || !/^\d+$/.test(amountRaw)) {
      throw new Error("user and amountRaw (integer string) are required");
    }
    return NextResponse.json(await buildDevnetTx(action as DevnetAction, new PublicKey(user), BigInt(amountRaw)));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "failed to build transaction" }, { status: 400 });
  }
}
