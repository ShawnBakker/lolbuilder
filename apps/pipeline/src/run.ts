/**
 * Full pipeline run (plan M2): roster → per-champion scrape → shards +
 * manifest. Publishing (Release + Pages) is workflow-level; this script's
 * contract is dist/shards/*.json + dist/manifest.json, exit non-zero when
 * the output should not be published.
 *
 * Failure budget: individual champion fetch failures are tolerated up to
 * max(5, 5% of roster) — beyond that the problem is systemic, not per-slug.
 * Any QDataFormatViolation aborts immediately (schema-change alarm).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { QDataFormatViolation } from "@lolbuilder/qdata";
import { fetchRoster } from "./champions.js";
import { FetchFailure, PoliteFetcher } from "./fetcher.js";
import { scrapeChampion } from "./scrape.js";

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;

const outDir = join(process.cwd(), "dist");
const shardDir = join(outDir, "shards");
mkdirSync(shardDir, { recursive: true });

const fetcher = new PoliteFetcher(join(process.cwd(), ".cache"));
const roster = await fetchRoster(fetcher);
const targets = roster.champions.slice(0, limit === Infinity ? undefined : limit);
console.log(`pipeline: patch ${roster.patch} (ddragon ${roster.ddragon}), ${targets.length}/${roster.champions.length} champions`);

const failures: Array<{ slug: string; error: string }> = [];
const published: Array<{ cid: number; slug: string; name: string; bytes: number }> = [];

for (const champ of targets) {
  try {
    const shard = await scrapeChampion(fetcher, champ, roster.patch);
    const json = JSON.stringify(shard);
    writeFileSync(join(shardDir, `${champ.slug}.json`), json);
    published.push({ ...champ, bytes: json.length });
  } catch (err) {
    if (err instanceof QDataFormatViolation) throw err; // schema alarm — abort
    if (err instanceof FetchFailure || err instanceof Error) {
      failures.push({ slug: champ.slug, error: err.message });
      console.error(`SKIP ${champ.slug}: ${err.message}`);
      continue;
    }
    throw err;
  }
}

const manifest = {
  patch: roster.patch,
  ddragon: roster.ddragon,
  generatedAt: new Date().toISOString(),
  champions: published.map(({ bytes: _bytes, ...c }) => c),
  missing: failures,
  requests: { fetched: fetcher.fetched, cached: fetcher.cached },
};
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

const sizes = published.map((p) => p.bytes).sort((a, b) => a - b);
const kb = (n: number) => `${(n / 1024).toFixed(0)}KB`;
console.log(
  `shards: ${published.length} emitted (${failures.length} failed); ` +
    `sizes min ${kb(sizes[0] ?? 0)} / median ${kb(sizes[Math.floor(sizes.length / 2)] ?? 0)} / max ${kb(sizes[sizes.length - 1] ?? 0)}; ` +
    `requests ${fetcher.fetched} live + ${fetcher.cached} cached`,
);

const budget = Math.max(5, Math.ceil(roster.champions.length * 0.05));
if (failures.length > budget) {
  console.error(`FAIL: ${failures.length} champion failures exceed budget ${budget} — systemic, not publishing`);
  process.exit(1);
}
