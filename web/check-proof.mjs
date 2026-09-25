import { withApp, text } from "./serve.mjs";
await withApp("@portage/web", 3161, async (get) => {
  const raw = await (await get("/api/simulate?quote=raw")).json();
  const plain = await (await get("/api/simulate?quote=plain")).json();
  if (!/6081|QuoteMintHasNonZeroTransferFee/.test(JSON.stringify(raw))) throw new Error(`raw tKalshi simulation must fail with 6081: ${JSON.stringify(raw).slice(0, 200)}`);
  if (plain.err !== null) throw new Error(`plain quote simulation must succeed: ${JSON.stringify(plain).slice(0, 200)}`);
  if (!(plain.logs?.length > 3) || !(raw.logs?.length > 3)) throw new Error("both simulations must return real program logs");
  const t = text(await (await get("/proof")).text());
  if (!/QuoteMintHasNonZeroTransferFee/.test(t)) throw new Error("/proof must show the live rejection");
  console.log("ok: live red (6081) and green simulations served and shown on /proof");
});
