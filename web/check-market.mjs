import { withApp, text } from "./serve.mjs";
await withApp("@portage/web", 3163, async (get) => {
  const r = await (await get("/api/tmarket")).json();
  for (const t of ["tKalshi", "tOpenAI"]) {
    const x = r[t];
    if (!(x?.markPrice > 0) || !(x?.dexPrice > 0) || !Number.isFinite(x?.premiumPct) || !x?.pool) throw new Error(`${t} needs markPrice, dexPrice, premiumPct, pool: ${JSON.stringify(x)}`);
    if (Math.abs(x.premiumPct - (x.dexPrice / x.markPrice - 1) * 100) > 0.01) throw new Error(`${t} premium inconsistent`);
  }
  const page = text(await (await get("/market")).text());
  if (!/premium|discount/i.test(page) || !/Wrap/.test(page)) throw new Error("/market must show premium vs mark and a Wrap action");
  console.log(`ok: tKalshi ${r.tKalshi.premiumPct.toFixed(2)}% vs mark, tOpenAI ${r.tOpenAI.premiumPct.toFixed(2)}% vs mark`);
});
