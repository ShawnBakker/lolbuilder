/**
 * Enemy-role inference (spec AC-M7-7, M7.3). PC-M7-3 established the LCU
 * exposes NO enemy positions, so the per-lane pick distributions (M7.0's
 * `lanes` shard field) carry inference entirely — there is no fallback
 * signal. The honesty rule (AC-M7-8): a guess below the confidence bar is
 * NOT made — the slot stays blank for manual assignment. Never confidently
 * wrong; blank beats wrong.
 */
import type { Lane } from "@lolbuilder/types";

/**
 * OI-M7-1's default: the pick-share % at or above which a role
 * auto-assigns. Chosen so only clear majorities assign: one-role mains
 * (Kha'Zix 99.3 jungle) and strong defaults (Aatrox 78.9 top) clear it; a
 * true flex (~50/45) does not and stays blank. Named and tunable; revisit
 * with real champ-select observation per the spec.
 */
export const INFERENCE_THRESHOLD = 60;

export interface EnemyToInfer {
  cid: number;
  /** Per-lane pick share % from the shard; absent (pre-M7.0 shard or
   * unloaded) means this enemy cannot be inferred and stays blank. */
  lanes?: Record<Lane, number>;
}

export interface InferredRole {
  cid: number;
  lane: Lane;
  /** The pick share that justified the guess — shown beside the "inferred"
   * marking so the user sees the evidence, not just the conclusion. */
  share: number;
}

/**
 * Greedy, most-confident-first assignment: each round, the (enemy, lane)
 * pair with the highest share among unassigned enemies and untaken lanes
 * is assigned — iff it clears the threshold. Enemies whose best available
 * lane falls below it are omitted (blank → manual). Handles collisions the
 * honest way: the second jungle-main loses jungle to the first and almost
 * never clears the bar elsewhere, so it stays blank rather than being
 * dumped confidently into a lane it never plays.
 */
export function inferEnemyRoles(enemies: EnemyToInfer[], threshold: number = INFERENCE_THRESHOLD): InferredRole[] {
  const unassigned = enemies.filter((e) => e.lanes);
  const taken = new Set<Lane>();
  const out: InferredRole[] = [];

  while (unassigned.length > 0) {
    let best: { idx: number; lane: Lane; share: number } | null = null;
    for (const [idx, e] of unassigned.entries()) {
      for (const [lane, share] of Object.entries(e.lanes!) as Array<[Lane, number]>) {
        if (taken.has(lane)) continue;
        if (!best || share > best.share) best = { idx, lane, share };
      }
    }
    if (!best || best.share < threshold) break; // nothing left clears the bar
    const enemy = unassigned.splice(best.idx, 1)[0]!;
    taken.add(best.lane);
    out.push({ cid: enemy.cid, lane: best.lane, share: best.share });
  }
  return out;
}
