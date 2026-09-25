// Copies the git-tracked pages of ../docs into web/content/docs (markdown) and web/public/docs (architecture assets).
// .vercelignore drops docs/, so the copy is committed; on Vercel the source is absent and this is a no-op.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(web, "..");
if (!existsSync(join(root, "docs"))) process.exit(0);

// Only tracked files: ignored/private notes (WIN-CONDITIONS.md) never leave the repo root.
// Vercel builds from an upload with no .git; the committed copy is used as-is there.
let files;
try {
  files = execFileSync("git", ["ls-files", "docs"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").filter(Boolean);
} catch {
  process.exit(0);
}
if (!files.length) process.exit(0);
const md = join(web, "content/docs"), assets = join(web, "public/docs");
rmSync(md, { recursive: true, force: true });
rmSync(assets, { recursive: true, force: true });
for (const f of files) {
  const rel = f.slice("docs/".length);
  const dest = join(rel.endsWith(".md") ? md : assets, rel);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(join(root, f), dest);
}
console.log(`sync-docs: ${files.length} tracked files`);
