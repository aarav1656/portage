import { NextResponse } from "next/server";
import { fetchMarketSnapshot } from "@/lib/market";

export async function GET() {
  try {
    const snapshot = await fetchMarketSnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : "market data unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
