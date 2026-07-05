/**
 * LcuProvider (M7.4): a BoardSource fed by the local helper.
 *
 * DEGRADATION IS DELEGATION (AC-M7-9): this provider WRAPS the manual
 * provider. Whenever it is not live — helper absent, client not running,
 * not in champ-select, protocol mismatch, unrecognized payload — every
 * board call delegates to the same ManualProvider instance, so "degrades to
 * manual entry" is structural: it IS v1's board, same object, the user's
 * manual entries intact. No hang, no stale data, no implied connection:
 * status() names the state and the UI renders it (AC-M7-10).
 *
 * Enemy roles: confident inferences arrive marked { share } (AC-M7-8);
 * below-threshold enemies carry unknownRole and are EXCLUDED from
 * DraftState until a human assigns — a wrong vslane table can never be
 * selected silently. User corrections go through RoleOverrides
 * (sticky-until-champion-changes, AC-M7-2b).
 */
import { HELPER_PROTOCOL, LANES, type DraftState, type Lane } from "@lolbuilder/types";
import { inferEnemyRoles } from "@lolbuilder/core";
import { getLoaded, trackLoaded } from "./data.js";
import { RoleOverrides } from "./overrides.js";
import type { BoardSlot, BoardSource, ManualProvider } from "./provider.js";

export const LCU_POLL_MS = 2000; // OI-M7-2: polling proved sufficient live (PC-M7-3)
export const HELPER_URL = "http://127.0.0.1:27437";

export type LcuStatus =
  | { kind: "connecting" }
  | { kind: "no-helper" }
  | { kind: "helper-no-client" }
  | { kind: "not-in-champ-select" }
  | { kind: "version-mismatch"; helperProtocol: number; expected: number }
  | { kind: "unrecognized-payload"; invariant: string }
  | { kind: "live"; phase: string };

interface HelperSession {
  myTeam: Array<{ cellId: number; championId: number; assignedPosition: string }>;
  theirTeam: Array<{ cellId: number; championId: number; assignedPosition: string }>;
  localPlayerCellId: number;
  timerPhase: string;
  gameId: number;
  queueId: number;
}

/** Live-session metadata for calibration capture (C.0). Null unless live. */
export interface LiveMeta {
  gameId: number;
  queueId: number;
  phase: string;
  /** Local player's locked championId, 0 while still picking. */
  ownChampionId: number;
  enemiesVisible: number;
  alliesVisible: number;
}

/** LCU position names → our lanes ("utility" is support; unknowns ignored). */
const POSITION_TO_LANE: Record<string, Lane> = {
  top: "top",
  jungle: "jungle",
  middle: "middle",
  bottom: "bottom",
  utility: "support",
  support: "support",
};

export class LcuProvider implements BoardSource {
  #manual: ManualProvider;
  #overrides = new RoleOverrides();
  #status: LcuStatus = { kind: "connecting" };
  #liveSlots: BoardSlot[] | null = null;
  #session: HelperSession | null = null;
  #version = 0;
  #listeners = new Set<() => void>();
  #timer: ReturnType<typeof setInterval> | null = null;

  constructor(manualFallback: ManualProvider) {
    this.#manual = manualFallback;
    // fallback changes must re-render the board while degraded
    this.#manual.subscribe(() => this.#emit());
  }

  status(): LcuStatus {
    return this.#status;
  }

  /** Calibration capture reads this (C.0); null in every non-live state. */
  liveMeta(): LiveMeta | null {
    if (!this.#session) return null;
    const s = this.#session;
    const you = s.myTeam.find((p) => p.cellId === s.localPlayerCellId);
    return {
      gameId: s.gameId,
      queueId: s.queueId,
      phase: s.timerPhase,
      ownChampionId: you?.championId ?? 0,
      enemiesVisible: s.theirTeam.filter((p) => p.championId > 0).length,
      alliesVisible: s.myTeam.filter((p) => p.championId > 0).length,
    };
  }

  start(): void {
    if (this.#timer) return;
    void this.pollOnce();
    this.#timer = setInterval(() => void this.pollOnce(), LCU_POLL_MS);
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    this.#setState({ kind: "connecting" }, null);
    this.#overrides.clear();
  }

  /** One poll cycle — public so tests drive it deterministically. */
  async pollOnce(): Promise<void> {
    let body: Record<string, unknown>;
    try {
      const res = await fetch(`${HELPER_URL}/champ-select`);
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      this.#setState({ kind: "no-helper" }, null);
      return;
    }
    const state = String(body["state"] ?? "");
    if (state === "in-champ-select") {
      const protocol = Number(body["protocol"] ?? 0);
      if (protocol !== HELPER_PROTOCOL) {
        // AC-M7-14: explained, not mysterious — and NOT consumed.
        this.#setState({ kind: "version-mismatch", helperProtocol: protocol, expected: HELPER_PROTOCOL }, null);
        return;
      }
      const session = body["session"] as unknown as HelperSession;
      this.#setState({ kind: "live", phase: session.timerPhase }, session);
      return;
    }
    if (state === "client-not-running" || state === "client-unreachable") this.#setState({ kind: "helper-no-client" }, null);
    else if (state === "not-in-champ-select") {
      this.#setState({ kind: "not-in-champ-select" }, null);
      this.#overrides.clear(); // session over: nothing carries to the next draft (AC-M7-2b)
    } else if (state === "unrecognized-payload") this.#setState({ kind: "unrecognized-payload", invariant: String(body["invariant"] ?? "?") }, null);
    else this.#setState({ kind: "no-helper" }, null);
  }

  #lastSignature = "";

  #setState(status: LcuStatus, session: HelperSession | null): void {
    // Change detection MUST run on the DERIVED slots, not the raw session:
    // slots also depend on shard arrivals (inference priors) and overrides.
    // Comparing the session alone froze the UI on a stale "role needed"
    // when a shard loaded without the session changing — observed live
    // 2026-07-04 (Vel'Koz, support 63.6% ≥ threshold, badge never updated).
    const liveSlots = session ? this.#deriveSlots(session) : null;
    const signature = JSON.stringify({ s: status, slots: liveSlots });
    const changed = signature !== this.#lastSignature;
    this.#lastSignature = signature;
    this.#status = status;
    this.#session = session;
    this.#liveSlots = liveSlots;
    if (changed) this.#emit();
  }

  #deriveSlots(s: HelperSession): BoardSlot[] {
    // allies: you land in slot 0 (the pick slot), teammates fill 1–4;
    // roles come straight from the game (assignedPosition), unmarked.
    const you = s.myTeam.find((p) => p.cellId === s.localPlayerCellId);
    const mates = s.myTeam.filter((p) => p.cellId !== s.localPlayerCellId);
    const allyOrder = [you, ...mates].filter((p): p is NonNullable<typeof p> => Boolean(p));
    const allies: BoardSlot[] = allyOrder.map((p, index) => ({
      side: "ally",
      index,
      lane: POSITION_TO_LANE[p.assignedPosition] ?? LANES[index]!,
      cid: p.championId > 0 ? p.championId : null,
    }));

    // enemies: champions from locks; roles from override > inference > unknown
    const enemyCells = [...s.theirTeam].sort((a, b) => a.cellId - b.cellId);
    for (const p of enemyCells) if (p.championId > 0) trackLoaded(p.championId); // AC-2 pattern: prefetch on appearance
    const inferences = inferEnemyRoles(
      enemyCells
        .filter((p) => p.championId > 0 && !this.#overrides.get(p.cellId, p.championId))
        .map((p) => ({ cid: p.championId, lanes: getLoaded(p.championId)?.lanes })),
    );
    const enemies: BoardSlot[] = enemyCells.map((p, index) => {
      const base: BoardSlot = { side: "enemy", index, lane: "top", cid: p.championId > 0 ? p.championId : null, unknownRole: true };
      if (p.championId <= 0) return { ...base, unknownRole: false }; // empty seat, nothing to claim
      const override = this.#overrides.get(p.cellId, p.championId);
      if (override) return { ...base, lane: override, unknownRole: false };
      const inf = inferences.find((r) => r.cid === p.championId);
      if (inf) return { ...base, lane: inf.lane, inferred: { share: inf.share }, unknownRole: false };
      return base; // below threshold: role needed, excluded from scoring
    });
    return [...allies, ...enemies];
  }

  // ---- BoardSource: live serves LCU state; otherwise pure delegation ----
  version(): number {
    return this.#version + this.#manual.version();
  }

  slots(): readonly BoardSlot[] {
    return this.#liveSlots ?? this.#manual.slots();
  }

  assign(side: BoardSlot["side"], index: number, cid: number | null): void {
    if (!this.#liveSlots) this.#manual.assign(side, index, cid);
    // live mode: champions come from the game; assignment is read-only
  }

  setLane(side: BoardSlot["side"], index: number, lane: Lane): void {
    if (!this.#liveSlots || !this.#session) {
      this.#manual.setLane(side, index, lane);
      return;
    }
    if (side === "enemy") {
      const cell = [...this.#session.theirTeam].sort((a, b) => a.cellId - b.cellId)[index];
      if (cell && cell.championId > 0) {
        this.#overrides.set(cell.cellId, cell.championId, lane); // sticky per (slot, champion)
        this.#liveSlots = this.#deriveSlots(this.#session);
        this.#emit();
      }
    }
    // ally lanes come from the game; nothing to correct
  }

  nextEmpty(): { side: BoardSlot["side"]; index: number } | null {
    return this.#liveSlots ? null : this.#manual.nextEmpty();
  }

  getDraftState(): DraftState | null {
    if (!this.#liveSlots) return this.#manual.getDraftState();
    const pick = this.#liveSlots.find((s) => s.side === "ally" && s.index === 0);
    if (!pick?.cid) return null;
    return {
      pick: { cid: pick.cid, lane: pick.lane },
      allies: this.#liveSlots.filter((s) => s.side === "ally" && s.index > 0 && s.cid !== null).map((s) => ({ cid: s.cid!, lane: s.lane })),
      // unknownRole enemies are EXCLUDED: a guessed-wrong lane must never
      // silently pick a vslane table (AC-M7-8's scoring-side guarantee)
      enemies: this.#liveSlots.filter((s) => s.side === "enemy" && s.cid !== null && !s.unknownRole).map((s) => ({ cid: s.cid!, lane: s.lane })),
    };
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit(): void {
    this.#version++;
    for (const l of this.#listeners) l();
  }
}
