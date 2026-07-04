/**
 * AC-M7-2b: the sticky-until-champion-changes reconciliation — with the
 * flicker case tested explicitly (the reviewer's second hard-look item),
 * because PC-M7-3's live observation is what forced this model.
 */
import { describe, expect, it } from "vitest";
import { RoleOverrides } from "../src/overrides.js";

const SLOT = 7;
const SINGED = 27;
const SION = 14;

describe("RoleOverrides (sticky-until-champion-changes)", () => {
  it("survives the observed hover flicker A→B→A (Singed→Sion→Singed)", () => {
    const o = new RoleOverrides();
    o.set(SLOT, SINGED, "top"); // user corrects while Singed is hovered
    expect(o.get(SLOT, SINGED)).toBe("top");
    expect(o.get(SLOT, SION)).toBeNull(); // flicker to Sion: override does NOT apply
    expect(o.get(SLOT, SINGED)).toBe("top"); // flicker back: override applies AGAIN
  });

  it("clears in effect on a genuine champion swap — a different pick needs a fresh judgment", () => {
    const o = new RoleOverrides();
    o.set(SLOT, SINGED, "top");
    // enemy genuinely re-picks Sion; the Singed override never matches again
    expect(o.get(SLOT, SION)).toBeNull();
    // a new correction for Sion is independent
    o.set(SLOT, SION, "jungle");
    expect(o.get(SLOT, SION)).toBe("jungle");
    expect(o.get(SLOT, SINGED)).toBe("top"); // and would only ever re-apply if Singed returned to this slot
  });

  it("overrides are per-slot: the same champion in another slot is unaffected", () => {
    const o = new RoleOverrides();
    o.set(SLOT, SINGED, "top");
    expect(o.get(SLOT + 1, SINGED)).toBeNull();
  });

  it("clear() ends the session — nothing carries into the next draft", () => {
    const o = new RoleOverrides();
    o.set(SLOT, SINGED, "top");
    o.clear();
    expect(o.get(SLOT, SINGED)).toBeNull();
  });
});
