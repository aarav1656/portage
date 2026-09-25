import { withApp } from "./serve.mjs";
await withApp("@portage/web", 3162, async (get) => {
  const m = await (await get("/api/market")).json();
  const mark = m.tKalshi.markPrice;
  const r = await (await get("/api/launch-sim?name=Test&symbol=TST&supply=1000000000&startMcapUsd=50000")).json();
  if (r.err !== null) throw new Error(`launch simulation must succeed on mainnet: ${JSON.stringify(r).slice(0, 200)}`);
  if (!(r.logs?.length > 3)) throw new Error("real program logs required");
  if (Math.abs(r.anchor?.tesseraMarkPrice - mark) > 1e-9) throw new Error("launch must be anchored to the live Tessera mark price");
  const implied = r.startPriceUsd * 1000000000;
  if (Math.abs(implied - 50000) / 50000 > 0.05) throw new Error(`start price must match requested mcap within 5%: implied ${implied}`);
  console.log(`ok: launch config simulated on mainnet (err null), start mcap $${implied.toFixed(0)} anchored to tKalshi mark ${mark}`);
});
