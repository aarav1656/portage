import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import seed from "./tessera-seed.json";

export interface TesseraCacheEntry {
  code: string;
  markPrice: number;
  fetchedAt: string; // ISO string
}

export interface TesseraCacheData {
  entries: TesseraCacheEntry[];
}

// Seed: a real snapshot written by `pnpm seed-tessera` from a live API response (fetchedAt inside).
// Runtime updates go to the OS temp dir, the only writable path on Vercel, plus memory.
const TMP_PATH = join(tmpdir(), "portage-tessera.json");
let memory: TesseraCacheData | null = null;

export async function readCache(): Promise<TesseraCacheData | null> {
  if (memory) return memory;
  try {
    memory = JSON.parse(await fs.readFile(TMP_PATH, "utf-8")) as TesseraCacheData;
  } catch {
    memory = seed as TesseraCacheData;
  }
  return memory;
}

export async function writeCache(data: TesseraCacheData): Promise<void> {
  memory = data;
  try {
    await fs.writeFile(TMP_PATH, JSON.stringify(data));
  } catch {
    // Read-only filesystem: the in-memory copy still serves this instance.
  }
}

export async function getCachedPrice(code: string): Promise<TesseraCacheEntry | null> {
  const cache = await readCache();
  if (!cache) return null;
  return cache.entries.find((e) => e.code === code) || null;
}

export async function updateCacheEntry(entry: TesseraCacheEntry): Promise<void> {
  const cache = await readCache();
  const data: TesseraCacheData = cache || { entries: [] };
  const idx = data.entries.findIndex((e) => e.code === entry.code);
  if (idx >= 0) {
    data.entries[idx] = entry;
  } else {
    data.entries.push(entry);
  }
  await writeCache(data);
}
