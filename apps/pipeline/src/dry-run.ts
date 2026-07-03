/**
 * PC-7 dry-run (plan M1 task 6): fetch → deserialize → validate → emit
 * normalized shards for a 3-champion slice, executed FROM GitHub Actions so
 * success replicates D5's datacenter-IP assumption on GH's actual egress
 * class. This is a slice of M2's pipeline, not the pipeline itself — trigger
 * logic, caching, and the full champion list arrive in M2.
 *
 * Politeness (CLAUDE.md hard rules): sequential, ≥2s apart, honest UA.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ddragonToLolalytics } from "@lolbuilder/types";
import { extractGameLength, extractMatchups, extractSynergy, parsePayload } from "@lolbuilder/qdata";

const UA = "lolbuilder-pipeline-dry-run (github.com/ShawnBakker/lolbuilder)";
const CHAMPS = ["aatrox", "lulu", "jinx"];
const DELAY_MS = 2000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let first = true;
async function politeJson(url: string): Promise<unknown> {
  if (!first) await sleep(DELAY_MS);
  first = false;
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

const versions = (await politeJson("https://ddragon.leagueoflegends.com/api/versions.json")) as string[];
const ddragon = versions[0];
if (!ddragon) throw new Error("empty DDragon version manifest");
const patch = ddragonToLolalytics(ddragon);
console.log(`dry-run: ddragon ${ddragon} → lolalytics patch ${patch}`);

const outDir = join(process.cwd(), "dist", "shards");
mkdirSync(outDir, { recursive: true });

for (const champ of CHAMPS) {
  const build = parsePayload(await politeJson(`https://lolalytics.com/lol/${champ}/build/q-data.json`));
  const gameLength = extractGameLength(build);

  const counters = parsePayload(await politeJson(`https://lolalytics.com/lol/${champ}/counters/q-data.json`));
  const matchups = extractMatchups(counters);

  const synergy = extractSynergy(
    await politeJson(
      `https://a1.lolalytics.com/mega/?ep=build-team&v=1&patch=${patch}&c=${champ}&lane=all&tier=emerald_plus&queue=ranked&region=all`,
    ),
  );

  const shard = { champ, patch, gameLength, matchups, synergy };
  writeFileSync(join(outDir, `${champ}.json`), JSON.stringify(shard));
  const synergyRows = Object.values(synergy).reduce((a, rows) => a + rows.length, 0);
  console.log(`${champ}: ${matchups.length} matchups, ${synergyRows} synergy rows, 7+7 buckets → shard emitted`);
}

console.log(`dry-run OK: ${CHAMPS.length} shards in ${outDir}`);
