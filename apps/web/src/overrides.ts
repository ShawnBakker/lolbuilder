/**
 * Role-override reconciliation (spec AC-M7-2b, M7.3): a user's manual role
 * correction is keyed on (slot, championId) and applies ONLY while that
 * exact pair holds. This makes the sticky-until-champion-changes model
 * structural rather than event-driven:
 *
 * - Hover flicker A→B→A (observed live in PC-M7-3: Singed→Sion→Singed):
 *   the override stored for (slot, A) simply doesn't apply while B occupies
 *   the slot, and applies AGAIN when A returns — it survives the flicker
 *   without any special-casing.
 * - Genuine swap A→B: the (slot, A) override never matches again — cleared
 *   in effect, because it described a different pick.
 *
 * No deletion-on-update logic exists to get wrong; the key IS the model.
 */
import type { Lane } from "@lolbuilder/types";

export class RoleOverrides {
  #map = new Map<string, Lane>();

  #key(slotIndex: number, championId: number): string {
    return `${slotIndex}:${championId}`;
  }

  /** Record a manual correction for this (slot, champion) pair. */
  set(slotIndex: number, championId: number, lane: Lane): void {
    this.#map.set(this.#key(slotIndex, championId), lane);
  }

  /** The override lane iff one exists for exactly this pair. */
  get(slotIndex: number, championId: number): Lane | null {
    return this.#map.get(this.#key(slotIndex, championId)) ?? null;
  }

  /** Session over (left champ-select) — nothing carries across drafts. */
  clear(): void {
    this.#map.clear();
  }
}
