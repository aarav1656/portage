#!/usr/bin/env node
import { promises as fs } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TESSERA_API = "https://rest-api.tessera.pe/v1/public/token-details";
const CACHE_PATH = new URL("../.cache/tessera.json", import.meta.url).pathname;

async function main() {
  try {
    const res = await fetch(TESSERA_API);
    if (!res.ok) {
      console.error(`Tessera API failed: ${res.status}`);
      process.exit(1);
    }
    const rows = await res.json();
    if (!Array.isArray(rows)) {
      console.error("Tessera API returned invalid data");
      process.exit(1);
    }

    const entries = rows
      .filter((r) => r.code === "tKalshi" || r.code === "tOpenAI")
      .map((r) => ({
        code: r.code,
        markPrice: r.markPrice,
        fetchedAt: new Date().toISOString(),
      }));

    if (entries.length === 0) {
      console.error("No Tessera tokens found");
      process.exit(1);
    }

    const cacheDir = dirname(CACHE_PATH);
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(CACHE_PATH, JSON.stringify({ entries }, null, 2));
    console.log(`Seeded cache with ${entries.length} tokens`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
