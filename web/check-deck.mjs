// Independent check for the /pitch deck. Owned by the orchestrator.
import { withApp, text } from "./serve.mjs";
await withApp("@portage/web", 3164, async (get) => {
  const html = await (await get("/pitch")).text();
  const slides = (html.match(/data-slide=/g) ?? []).length;
  if (slides < 8) throw new Error(`need >= 8 slides marked data-slide, got ${slides}`);
  if (!/ArrowRight|keydown/.test(html) && !/data-deck-nav/.test(html)) throw new Error("deck needs keyboard navigation (ArrowRight/keydown) or data-deck-nav");
  if (/—|&mdash;/.test(html)) throw new Error("em dash in deck");
  const live = await (await get("/api/market")).json();
  const v = String(live.tKalshi.transferFeeBps + " bps");
  if (!text(html).includes(v)) throw new Error(`deck must show the live figure ${v} from /api/market`);
  console.log(`ok: ${slides} slides, keyboard nav, live figure ${v}`);
});
