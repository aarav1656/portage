import { NextResponse } from "next/server";
import { fetchTMarketSnapshot } from "@/lib/tmarket";

export async function GET() {
  try {
    const snapshot = await fetchTMarketSnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : "tmarket data unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
