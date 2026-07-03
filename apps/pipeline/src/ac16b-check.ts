/**
 * AC-16b semantics sanity check (plan M4 gate): bucket WR should behave as
 * the game-length-conditional construct predicts against known scaling
 * profiles — a hyperscaler's WR rises with game length, a lane bully /
 * early-tempo champion's falls.
 *
 * Usage: tsx src/ac16b-check.ts <shards-dir>
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BUCKET_INDICES, type Shard } from "@lolbuilder/types";

const dir = process.argv[2];
if (!dir) throw new Error("usage: ac16b-check <shards-dir>");

const PROFILES: Array<{ slug: string; expect: "rising" | "falling" }> = [
  { slug: "kayle", expect: "rising" }, // canonical hyperscaler
  { slug: "kassadin", expect: "rising" }, // canonical late-game insurance
  { slug: "renekton", expect: "falling" }, // canonical lane bully
  { slug: "elise", expect: "falling" }, // early-tempo jungler
];

let pass = 0;
for (const { slug, expect } of PROFILES) {
  const s = JSON.parse(readFileSync(join(dir, `${slug}.json`), "utf8")) as Shard;
  const curve = BUCKET_INDICES.map((b) => (100 * s.gameLength.timeWin[b]) / s.gameLength.time[b]);
  // trend = late-third mean minus early-third mean (robust to bucket noise)
  const early = (curve[0]! + curve[1]!) / 2;
  const late = (curve[4]! + curve[5]! + curve[6]!) / 3;
  const trend = late - early;
  const ok = expect === "rising" ? trend > 1 : trend < -1;
  if (ok) pass++;
  console.log(
    `${slug.padEnd(10)} expect ${expect.padEnd(7)} curve [${curve.map((v) => v.toFixed(1)).join(", ")}] ` +
      `late-early = ${trend.toFixed(2)}pp -> ${ok ? "OK" : "VIOLATED"}`,
  );
}
console.log(`\nAC-16b: ${pass}/${PROFILES.length} profiles behave as the construct predicts`);
if (pass < PROFILES.length) process.exit(1);
