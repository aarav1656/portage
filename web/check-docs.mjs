// Independent check for /docs: every tracked docs/ page renders with its H1, every internal link and anchor resolves, private files stay unreachable.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { basename } from "node:path";
import { withApp, text } from "./serve.mjs";

const root = new URL("..", import.meta.url).pathname;
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" }).trim().split("\n").filter(Boolean);
const tracked = git("ls-files", "docs").filter((f) => f.endsWith(".md"));
const priv = git("ls-files", "--others", "docs");
if (!priv.length) console.warn("warn: no untracked/ignored file under docs/ to probe");
if (tracked.length < 10) throw new Error(`expected the tracked docs pages, got ${tracked.length}`);

const shipped = readdirSync(new URL("./content/docs", import.meta.url), { recursive: true }).filter((f) => f.endsWith(".md")).map((f) => `docs/${f}`).sort();
if (JSON.stringify(shipped) !== JSON.stringify([...tracked].sort())) throw new Error(`web/content/docs differs from git ls-files docs:\n shipped ${shipped}\n tracked ${tracked}`);
for (const f of tracked) if (readFileSync(new URL(`./content/${f}`, import.meta.url), "utf8") !== readFileSync(root + f, "utf8")) throw new Error(`web/content/${f} is stale; run node web/scripts/sync-docs.mjs`);

const urlOf = (f) => (f === "docs/README.md" ? "/docs" : `/docs/${basename(f, ".md")}`);
const h1Of = (f) => /^# (.+)$/m.exec(readFileSync(root + f, "utf8"))[1].replace(/`/g, "");

await withApp("@portage/web", 3171, async (get) => {
  const pages = new Map();
  for (const f of tracked) {
    const r = await get(urlOf(f));
    const html = await r.text();
    if (r.status !== 200) throw new Error(`${urlOf(f)} -> ${r.status}`);
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
    if (!h1 || text(h1[1]).trim() !== h1Of(f)) throw new Error(`${urlOf(f)} H1 "${h1 && text(h1[1]).trim()}" != "${h1Of(f)}"`);
    if (!html.includes('href="/docs"')) throw new Error(`${urlOf(f)} has no Docs nav link`);
    pages.set(urlOf(f), html);
  }

  let links = 0, anchors = 0;
  const seen = new Map();
  for (const [from, html] of pages) {
    const body = /class="doc-prose"[\s\S]*<\/article>/.exec(html)?.[0] ?? "";
    for (const [, href] of body.matchAll(/href="(\/[^"]*)"/g)) {
      const [path, hash] = href.split("#");
      if (!seen.has(path)) { const r = await get(path); seen.set(path, { status: r.status, html: await r.text() }); }
      const hit = seen.get(path);
      if (hit.status !== 200) throw new Error(`${from}: broken link ${href} -> ${hit.status}`);
      links++;
      if (hash) {
        if (!hit.html.includes(`id="${hash}"`)) throw new Error(`${from}: link ${href} has no #${hash} on target`);
        anchors++;
      }
    }
  }
  if (links < 20) throw new Error(`only ${links} internal links found; link extraction is broken`);

  const probes = priv.flatMap((f) => { const b = basename(f).replace(/\.[^.]+$/, ""); return [`/docs/${b}`, `/docs/${b.toLowerCase()}`, `/${f}`, `/docs/${basename(f)}`]; });
  for (const p of probes) {
    const r = await get(p);
    if (r.status !== 404) throw new Error(`private file reachable: ${p} -> ${r.status}`);
  }
  const all = [...pages.values()].join("");
  for (const f of priv) { const b = basename(f).replace(/\.[^.]+$/, ""); if (all.includes(b)) throw new Error(`private name ${b} appears in a docs page`); }
  console.log(`ok: ${pages.size} pages render with their H1, ${links} internal links (${anchors} anchors) resolve, ${probes.length} private probes 404 (${priv.join(", ")})`);
});
