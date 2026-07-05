/**
 * Calibration capture (spec C.0, OI-C-3 as confirmed): fire-and-forget
 * POSTs of the frontend-computed rating to the helper's local log.
 *
 * Capture moments:
 * - "at-pick": the first observation where the local player's championId
 *   is locked (0 → id transition — the confirmed definition). If the pick
 *   shard hasn't loaded at that instant, capture retries on subsequent
 *   polls until it can score; enemiesVisible/lockedAt record the actual
 *   conditions, so the slight drift is visible in the data, not hidden.
 * - "finalization": the first observation in FINALIZATION (GAME_STARTING
 *   accepted as fallback if FINALIZATION was never observed).
 *
 * Fire-and-forget is a hard property: nothing here may ever affect the
 * board. Failures are swallowed (an old helper without the route, a closed
 * helper, a rejected queue — all fine); the helper is the idempotency
 * authority, this class just avoids obvious duplicate sends.
 */
import { CALIBRATION_SCHEMA, type DraftState, type Shard } from "@lolbuilder/types";
import { K_MATCHUP, K_SYNERGY, scorePick, selectCells } from "@lolbuilder/core";
import { HELPER_URL } from "./lcu-provider.js";
import type { LiveMeta } from "./lcu-provider.js";

export interface CaptureSource {
  liveMeta(): LiveMeta | null;
  getDraftState(): DraftState | null;
}

type Phase = "at-pick" | "finalization";

export class CaptureController {
  #sent = new Set<string>();
  #getShard: (cid: number) => Shard | null;
  #post: (body: unknown) => Promise<unknown>;

  constructor(
    getShard: (cid: number) => Shard | null,
    post: (body: unknown) => Promise<unknown> = (body) =>
      fetch(`${HELPER_URL}/calibration-log`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  ) {
    this.#getShard = getShard;
    this.#post = post;
  }

  /** Call on every provider notification; cheap no-op when nothing to do. */
  onUpdate(source: CaptureSource): void {
    const meta = source.liveMeta();
    if (!meta || meta.gameId <= 0) return;
    if (meta.ownChampionId > 0) this.#tryCapture("at-pick", meta, source);
    if (meta.phase === "FINALIZATION" || meta.phase === "GAME_STARTING") this.#tryCapture("finalization", meta, source);
  }

  #tryCapture(phase: Phase, meta: LiveMeta, source: CaptureSource): void {
    const key = `${meta.gameId}:${phase}`;
    if (this.#sent.has(key)) return;
    const draft = source.getDraftState();
    if (!draft) return; // own pick not resolvable yet — retry next poll
    const shard = this.#getShard(draft.pick.cid);
    if (!shard) return; // shard still loading — retry next poll
    let rating: number;
    try {
      rating = scorePick(selectCells(draft, shard)).rating;
    } catch {
      return; // never let capture throw near the board
    }
    this.#sent.add(key); // mark before dispatch: one attempt per moment; the helper dedupes anyway
    void this.#post({
      schema: CALIBRATION_SCHEMA,
      gameId: meta.gameId,
      queueId: meta.queueId,
      phase,
      rating,
      draft,
      enemiesVisible: meta.enemiesVisible,
      alliesVisible: meta.alliesVisible,
      lockedAt: new Date().toISOString(),
      // rating provenance: entries logged under different k or patch are
      // not poolable — the context makes the first k-tune a stratification
      // instead of a silent dataset fork
      context: { patch: shard.patch, kMatchup: K_MATCHUP, kSynergy: K_SYNERGY },
    }).catch(() => undefined); // fire-and-forget, structurally
  }
}
