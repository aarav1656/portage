import { NextRequest, NextResponse } from "next/server";
import { buildUnwrapTx, parseWrapRequest, type WrapRequestBody } from "@/lib/vault-tx";

export async function POST(req: NextRequest) {
  let body: WrapRequestBody;
  try {
    body = (await req.json()) as WrapRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  try {
    const parsed = parseWrapRequest(body);
    const txBase64 = await buildUnwrapTx(parsed);
    return NextResponse.json({ txBase64 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to build unwrap transaction";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
