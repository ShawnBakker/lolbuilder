/**
 * Phase analysis over the 7 game-length buckets (spec F5).
 *
 * SEMANTICS (AC-16b / AC-19): bucket WR is conditional on the game ENDING in
 * that bucket — "win rate of games that ended early/mid/late", a selection
 * effect, NOT "strength during that phase". The UI disclosure states this
 * plainly; sanity-checked against known scaling profiles before shipping.
 */
import type { GameLengthData } from "@lolbuilder/types";
import { PHASE_BUCKETS, PHASE_FLOOR_N, type Phase } from "./constants.js";
import { shrinkWr } from "./math.js";

export interface PhaseRate {
  games: number;
  /** Shrunk WR %, or "insufficient" when games < PHASE_FLOOR_N (AC-16). */
  wr: number | "insufficient";
}

export type PhaseBreakdown = Record<Phase, PhaseRate>;

export function phaseBreakdown(gl: GameLengthData, baselineWr: number, k: number): PhaseBreakdown {
  const out = {} as PhaseBreakdown;
  for (const [phase, buckets] of Object.entries(PHASE_BUCKETS) as Array<[Phase, readonly string[]]>) {
    let games = 0;
    let wins = 0;
    for (const b of buckets) {
      games += gl.time[b as keyof typeof gl.time];
      wins += gl.timeWin[b as keyof typeof gl.timeWin];
    }
    out[phase] = {
      games,
      wr: games >= PHASE_FLOOR_N ? shrinkWr((100 * wins) / games, games, baselineWr, k) : "insufficient",
    };
  }
  return out;
}
