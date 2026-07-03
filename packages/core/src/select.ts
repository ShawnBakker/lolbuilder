/**
 * Cell selection: DraftState + shards → ScoreCells. Pure; shard I/O is the
 * caller's job (frontend loader / scripts).
 *
 * Lane-aware by contract (Gap B / AC-3): an enemy assigned lane L is looked
 * up in the pick's matchupsVsLane[L] table. Same-lane data is NEVER silently
 * substituted for an off-role assignment — a missing cross-lane cell is
 * reported in `missing`.
 */
import type { ChampionId, DraftState, Shard } from "@lolbuilder/types";
import type { ScoreCells } from "./score.js";

export function selectCells(draft: DraftState, pickShard: Shard): ScoreCells {
  if (pickShard.champ.cid !== draft.pick.cid) {
    throw new Error(`selectCells: shard is for cid ${pickShard.champ.cid}, draft pick is ${draft.pick.cid}`);
  }
  const cells: ScoreCells = {
    baseline: { wr: pickShard.baseline.wr, n: pickShard.baseline.n },
    matchups: [],
    synergies: [],
    missing: [],
  };

  for (const enemy of draft.enemies) {
    const table = pickShard.matchupsVsLane[enemy.lane] ?? [];
    const row = table.find((r) => r.cid === enemy.cid);
    if (row) cells.matchups.push({ cid: enemy.cid, wr: row.vsWr, n: row.n });
    else cells.missing.push({ kind: "matchup", cid: enemy.cid });
  }

  for (const ally of draft.allies) {
    const rows = pickShard.synergy[ally.lane] ?? [];
    const row = rows.find((r) => r.id === ally.cid);
    if (row) cells.synergies.push({ cid: ally.cid, wr: row.wr, n: row.n });
    else cells.missing.push({ kind: "synergy", cid: ally.cid });
  }

  return cells;
}

/** Convenience for ranking candidate picks: cid → shard lookup map. */
export type ShardIndex = ReadonlyMap<ChampionId, Shard>;
