/**
 * OI-4 sensitivity sweep (plan M3 exit gate): how sensitive are pick
 * rankings to the shrinkage constants? Metric blessed at plan review:
 * top-5 pick-ordering agreement across k ∈ {10,25,50}² over 20 deterministic
 * benchmark drafts built from the production dataset.
 *
 * Usage: tsx src/oi4-sweep.ts <shards-dir>
 * Decision rule: choose the k pair at the plateau; if no clear plateau,
 * default both to 50 and record as a v2 calibration dependency.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LANES, type DraftState, type Lane, type Shard } from "@lolbuilder/types";
import { scorePick, selectCells } from "@lolbuilder/core";

const dir = process.argv[2];
if (!dir) throw new Error("usage: oi4-sweep <shards-dir>");

const shards = new Map<number, Shard>();
const byLane: Record<Lane, Shard[]> = { top: [], jungle: [], middle: [], bottom: [], support: [] };
for (const f of readdirSync(dir).sort()) {
  const s = JSON.parse(readFileSync(join(dir, f), "utf8")) as Shard;
  shards.set(s.champ.cid, s);
  byLane[s.baseline.defaultLane].push(s);
}
console.log(`loaded ${shards.size} shards; per-lane pools:`, LANES.map((l) => `${l}:${byLane[l].length}`).join(" "));

const K_VALUES = [10, 25, 50] as const;
const N_DRAFTS = 20;
const POOL = 10; // candidates per draft
const TOP = 5;

interface Bench {
  draftFor: (cid: number) => DraftState;
  candidates: Shard[];
}

function buildBench(i: number): Bench {
  const lane = LANES[i % 5]!;
  const pool = byLane[lane];
  const start = (i * 7) % Math.max(1, pool.length - POOL);
  const candidates = pool.slice(start, start + POOL);
  const usedCids = new Set(candidates.map((c) => c.champ.cid));
  const pickLane = (l: Lane, salt: number): Shard => {
    const group = byLane[l];
    for (let j = 0; j < group.length; j++) {
      const s = group[(i * 13 + salt * 5 + j) % group.length]!;
      if (!usedCids.has(s.champ.cid)) {
        usedCids.add(s.champ.cid);
        return s;
      }
    }
    throw new Error("pool exhausted");
  };
  const enemies = LANES.map((l, j) => ({ cid: pickLane(l, j).champ.cid, lane: l }));
  const allies = LANES.filter((l) => l !== lane).map((l, j) => ({ cid: pickLane(l, 10 + j).champ.cid, lane: l }));
  return { candidates, draftFor: (cid) => ({ pick: { cid, lane }, allies, enemies }) };
}

const benches = Array.from({ length: N_DRAFTS }, (_, i) => buildBench(i));

function topList(bench: Bench, kMatchup: number, kSynergy: number): number[] {
  return bench.candidates
    .map((shard) => ({
      cid: shard.champ.cid,
      rating: scorePick(selectCells(bench.draftFor(shard.champ.cid), shard), { kMatchup, kSynergy }).rating,
    }))
    .sort((a, b) => b.rating - a.rating || a.cid - b.cid)
    .slice(0, TOP)
    .map((x) => x.cid);
}

const REF: [number, number] = [50, 50];
const refLists = benches.map((b) => topList(b, ...REF));

console.log(`\nconfig (kM,kS) | mean top-5 overlap vs (50,50) | top-1 agreement | exact top-5 order match`);
for (const kM of K_VALUES) {
  for (const kS of K_VALUES) {
    let overlap = 0;
    let top1 = 0;
    let exact = 0;
    benches.forEach((b, i) => {
      const list = topList(b, kM, kS);
      const ref = refLists[i]!;
      overlap += list.filter((c) => ref.includes(c)).length;
      if (list[0] === ref[0]) top1++;
      if (list.join(",") === ref.join(",")) exact++;
    });
    console.log(
      `(${String(kM).padStart(2)},${String(kS).padStart(2)})       | ${(overlap / N_DRAFTS).toFixed(2)}/5` +
        `                       | ${top1}/${N_DRAFTS}           | ${exact}/${N_DRAFTS}`,
    );
  }
}
