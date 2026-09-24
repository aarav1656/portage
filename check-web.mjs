// Independent check for the Portage web app. Owned by the orchestrator.
import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(new URL("./packages/exec/package.json", import.meta.url));
const { VersionedTransaction, Transaction } = require("@solana/web3.js");
const TK = "Kalshi", PORT = 3121, USER = "6GJbPKBtovsrMEEMcic5KMi5tswh9qSyT5ZYLMqEwNgt";
if (!existsSync(new URL("./DESIGN.md", import.meta.url))) throw new Error("no DESIGN.md at repo root");
const log = readFileSync(process.env.HOME + "/.config/agent-rules/frontend/design-log.jsonl", "utf8").trim().split("\n");
if (!log.some((l) => l.includes("stocklana/portage"))) throw new Error("design-log.jsonl has no entry for portage");
execSync("pnpm --filter @portage/web build", { stdio: "ignore" });
const srv = spawn("pnpm", ["--filter", "@portage/web", "exec", "next", "start", "--port", String(PORT)], { stdio: "ignore", detached: true });
const get = async (p, init) => { for (let i = 0; i < 60; i++) { try { return await fetch(`http://127.0.0.1:${PORT}${p}`, init); } catch { await new Promise((r) => setTimeout(r, 1000)); } } throw new Error(`no answer ${p}`); };
try {
  const home = await (await get("/")).text();
  if (!home.includes("QuoteMintHasNonZeroTransferFee")) throw new Error("home must show the real DBC rejection (QuoteMintHasNonZeroTransferFee)");
  if (!/tKalshi|tOpenAI/.test(home)) throw new Error("home must name the Tessera tokens");
  if (/<input[^>]*/.test(home) === false) throw new Error("no amount input for wrap");
  const r = await get("/api/wrap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ user: USER, token: TK, amountRaw: "1000000000" }) });
  const j = await r.json();
  if (!j.txBase64) throw new Error(`/api/wrap returned no tx: ${JSON.stringify(j).slice(0, 200)}`);
  const buf = Buffer.from(j.txBase64, "base64");
  let keys; try { keys = VersionedTransaction.deserialize(buf).message.staticAccountKeys.map(String); } catch { keys = Transaction.from(buf).compileMessage().accountKeys.map(String); }
  if (!keys.includes("AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V")) throw new Error("wrap tx does not call the Portage program");
  const m = await (await get("/api/market")).json();
  const hasValidMarkPrice = m.tKalshi?.markPrice > 0 && (m.tKalshi?.stale ? !!m.tKalshi?.asOf : true);
  if (!hasValidMarkPrice || !(m.tKalshi?.transferFeeBps > 0)) throw new Error(`/api/market must return Tessera mark price and on-chain fee bps: ${JSON.stringify(m).slice(0, 200)}`);
  console.log(`ok: DESIGN.md + design-log entry, rejection shown, wrap tx targets Portage, market live (fee ${m.tKalshi.transferFeeBps} bps)${m.tKalshi.stale ? " [stale]" : ""}`);
} finally { try { process.kill(-srv.pid); } catch {} }
