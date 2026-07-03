/**
 * Dataset loader. Shards live same-origin under ./data/ (PC-6's answer:
 * Release assets are CORS-blocked; the Pages deployment is the read path).
 *
 * AC-2: prefetch() is fired the moment a champion appears on the board —
 * champ select is fast, so data must already be local when scoring runs.
 * Shards measured 53–86KB; ≤10 in flight is well inside budget.
 */
import { ddragonToLolalytics, type ChampionRef, type Shard } from "@lolbuilder/types";

export interface Manifest {
  patch: string;
  ddragon: string;
  generatedAt: string;
  champions: ChampionRef[];
  missing: Array<{ slug: string; error: string }>;
}

const shardCache = new Map<number, Promise<Shard>>();
let manifest: Manifest | null = null;
let slugByCid = new Map<number, string>();

export async function loadManifest(): Promise<Manifest> {
  if (manifest) return manifest;
  const res = await fetch("./data/manifest.json");
  if (!res.ok) throw new Error(`manifest fetch failed: HTTP ${res.status}`);
  manifest = (await res.json()) as Manifest;
  slugByCid = new Map(manifest.champions.map((c) => [c.cid, c.slug]));
  return manifest;
}

export function prefetch(cid: number): Promise<Shard> {
  const cached = shardCache.get(cid);
  if (cached) return cached;
  const slug = slugByCid.get(cid);
  if (!manifest || !slug) return Promise.reject(new Error(`unknown cid ${cid} (manifest not loaded?)`));
  const p = fetch(`./data/${manifest.patch}/${slug}.json`).then((res) => {
    if (!res.ok) throw new Error(`shard fetch failed for ${slug}: HTTP ${res.status}`);
    return res.json() as Promise<Shard>;
  });
  p.catch(() => shardCache.delete(cid)); // failed fetches retry next time
  shardCache.set(cid, p);
  return p;
}

/** Non-blocking read: the shard if it has already arrived, else null. */
export function getLoaded(cid: number): Shard | null {
  return loadedShards.get(cid) ?? null;
}
const loadedShards = new Map<number, Shard>();
export function trackLoaded(cid: number): void {
  void prefetch(cid).then((s) => loadedShards.set(cid, s), () => undefined);
}

/**
 * AC-18: stale-data check — compare the dataset's patch against the live
 * DDragon manifest (CORS-open CDN), client-side.
 */
export async function checkStale(datasetPatch: string): Promise<{ stale: boolean; livePatch: string } | null> {
  try {
    const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
    if (!res.ok) return null;
    const versions = (await res.json()) as string[];
    const livePatch = ddragonToLolalytics(versions[0]!);
    return { stale: livePatch !== datasetPatch, livePatch };
  } catch {
    return null; // no network verdict — banner stays quiet rather than guessing
  }
}
