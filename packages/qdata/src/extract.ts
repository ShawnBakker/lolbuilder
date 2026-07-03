/**
 * Extraction of exactly the tables we consume (AC-8), with the AC-9 named
 * invariants. Extraction is shape-scan based (find objects by their key
 * signature) rather than path-based: the graph's layout shifts with the
 * site's route structure, but the shapes are the contract we validated.
 */

import {
  BUCKET_INDICES,
  LANES,
  type GameLengthData,
  type Lane,
  type MatchupRow,
  type TimeBuckets,
} from "@lolbuilder/types";
import { materialize, parsePayload, type QDataPayload } from "./graph.js";
import { violate } from "./violation.js";

export { parsePayload };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function numericBuckets(v: unknown, which: string, path: string): TimeBuckets {
  if (!isPlainObject(v)) {
    violate(`${which}-shape`, `${path} did not materialize to an object`);
  }
  const keys = Object.keys(v).sort();
  if (keys.length !== 7 || keys.join(",") !== BUCKET_INDICES.join(",")) {
    violate(`${which}-buckets`, `expected keys 1–7, got [${keys.join(",")}]`);
  }
  for (const k of BUCKET_INDICES) {
    if (typeof v[k] !== "number" || !Number.isFinite(v[k])) {
      violate(`${which}-numeric`, `bucket ${k} resolved to ${typeof v[k]}`);
    }
  }
  return v as unknown as TimeBuckets;
}

/**
 * Game-length buckets from a build-route payload.
 * Invariants: host object with both keys exists exactly once; both sides
 * materialize to objects keyed "1"–"7" with finite numbers; wins ≤ games.
 */
export function extractGameLength(payload: QDataPayload): GameLengthData {
  const hosts = payload.objs.filter(
    (o): o is Record<string, unknown> =>
      isPlainObject(o) && "time" in o && "timeWin" in o && Object.keys(o).length === 2,
  );
  if (hosts.length !== 1) {
    violate("time-host", `expected exactly 1 {time,timeWin} host object, found ${hosts.length}`);
  }
  const host = hosts[0]!;
  const time = numericBuckets(materialize(payload, host["time"], "$.time"), "time", "$.time");
  const timeWin = numericBuckets(materialize(payload, host["timeWin"], "$.timeWin"), "timeWin", "$.timeWin");
  for (const k of BUCKET_INDICES) {
    if (timeWin[k] > time[k]) {
      violate("wins-le-games", `bucket ${k}: timeWin ${timeWin[k]} > time ${time[k]}`);
    }
  }
  return { time, timeWin };
}

const MATCHUP_KEYS = ["cid", "vsWr", "n", "d1", "d2", "allWr", "defaultLane"] as const;

/**
 * Per-opponent matchup rows from a counters-route payload.
 * Invariants: rows non-empty; numeric fields finite post-resolution;
 * defaultLane is a known lane.
 */
export function extractMatchups(payload: QDataPayload): MatchupRow[] {
  const rawRows = payload.objs.filter(
    (o): o is Record<string, unknown> => isPlainObject(o) && MATCHUP_KEYS.every((k) => k in o),
  );
  if (rawRows.length === 0) {
    violate("matchups-empty", "no objects with the matchup-row key signature");
  }
  return rawRows.map((raw, i) => {
    const row = materialize(payload, raw, `$.matchup[${i}]`) as Record<string, unknown>;
    for (const k of ["cid", "vsWr", "n", "d1", "d2", "allWr"] as const) {
      if (typeof row[k] !== "number" || !Number.isFinite(row[k])) {
        violate("matchup-numeric", `row ${i} field ${k} resolved to ${typeof row[k]}`);
      }
    }
    if (!LANES.includes(row["defaultLane"] as Lane)) {
      violate("matchup-lane", `row ${i} defaultLane resolved to "${String(row["defaultLane"])}"`);
    }
    return row as unknown as MatchupRow;
  });
}
