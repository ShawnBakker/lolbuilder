/**
 * The DraftStateProvider seam (spec AC-1): DraftState is produced ONLY
 * through this interface. ManualProvider (the clickable board) is the sole
 * v1 implementation; LcuProvider implements the same contract in v2 —
 * that is the entire reason this file exists.
 */
import type { DraftState, Lane, SlotRef } from "@lolbuilder/types";

export interface DraftStateProvider {
  /** Current draft, or null while no pick champion is assigned. */
  getDraftState(): DraftState | null;
  /** Fires on every board change; returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/**
 * The board-facing contract (AC-M7-1b): the five concrete methods the board
 * UI depends on — enumerated by Pass A at seven call sites (App.tsx :13,
 * :50, :80, :85, :127, :138, :155) — lifted into an interface both
 * ManualProvider and (M7.4) LcuProvider satisfy. The scoring path needs
 * only DraftStateProvider; the board needs this. Provider *selection* is
 * AC-M7-2 (M7.4) — this milestone only makes the board provider-agnostic.
 */
export interface BoardSource extends DraftStateProvider {
  /** Monotonic change counter — a stable useSyncExternalStore snapshot. */
  version(): number;
  slots(): readonly BoardSlot[];
  assign(side: BoardSlot["side"], index: number, cid: number | null): void;
  setLane(side: BoardSlot["side"], index: number, lane: Lane): void;
  /** Next empty slot in draft order (allies then enemies), or null. */
  nextEmpty(): { side: BoardSlot["side"]; index: number } | null;
}

export interface BoardSlot {
  side: "ally" | "enemy";
  index: number; // 0–4 per side; ally 0 is the pick slot
  lane: Lane;
  cid: number | null;
  /**
   * Present iff the lane is an inference, not a human choice (AC-M7-8):
   * the board renders it visibly-as-guess with its evidence (the pick
   * share). A manual setLane() MUST clear it — the one-action correction.
   * ManualProvider never sets it; LcuProvider (M7.4) does.
   */
  inferred?: { share: number };
  /**
   * True when no role is known at all (below-threshold inference): the UI
   * prompts for assignment and the slot is EXCLUDED from DraftState until
   * a human supplies the lane — blank beats confidently wrong.
   */
  unknownRole?: boolean;
}

const DEFAULT_LANES: Lane[] = ["top", "jungle", "middle", "bottom", "support"];

export class ManualProvider implements BoardSource {
  #slots: BoardSlot[];
  #listeners = new Set<() => void>();
  #version = 0;

  /** Monotonic change counter — a stable useSyncExternalStore snapshot. */
  version(): number {
    return this.#version;
  }

  constructor() {
    this.#slots = (["ally", "enemy"] as const).flatMap((side) =>
      DEFAULT_LANES.map((lane, index) => ({ side, index, lane, cid: null })),
    );
  }

  slots(): readonly BoardSlot[] {
    return this.#slots;
  }

  assign(side: BoardSlot["side"], index: number, cid: number | null): void {
    const slot = this.#slots.find((s) => s.side === side && s.index === index);
    if (slot) {
      slot.cid = cid;
      this.#emit();
    }
  }

  setLane(side: BoardSlot["side"], index: number, lane: Lane): void {
    const slot = this.#slots.find((s) => s.side === side && s.index === index);
    if (slot) {
      slot.lane = lane;
      delete slot.inferred; // a human chose: the guess marking must not survive (AC-M7-8)
      this.#emit();
    }
  }

  getDraftState(): DraftState | null {
    const pickSlot = this.#slots.find((s) => s.side === "ally" && s.index === 0);
    if (!pickSlot?.cid) return null;
    const ref = (s: BoardSlot): SlotRef => ({ cid: s.cid!, lane: s.lane });
    return {
      pick: ref(pickSlot),
      allies: this.#slots.filter((s) => s.side === "ally" && s.index > 0 && s.cid !== null).map(ref),
      enemies: this.#slots.filter((s) => s.side === "enemy" && s.cid !== null).map(ref),
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

  /** Next empty slot in draft order (allies then enemies), or null. */
  nextEmpty(): { side: BoardSlot["side"]; index: number } | null {
    const empty = this.#slots.find((s) => s.cid === null);
    return empty ? { side: empty.side, index: empty.index } : null;
  }
}
