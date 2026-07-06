/**
 * Explain-why readings (UI pass): plain-language per-component sentences —
 * direction from the player's perspective, coarse strength bands, and the
 * thin-data qualifier baked into the sentence itself.
 */
import { describe, expect, it } from "vitest";
import { describeComponent } from "../src/display.js";

describe("describeComponent (explain-why, UI pass)", () => {
  it("direction, strength bands, and the thin-data qualifier", () => {
    expect(describeComponent("matchup", 0.09, 2400, "Darius")).toBe("the lane matchup vs Darius runs strongly in your favor");
    expect(describeComponent("matchup", -0.05, 300, "Teemo")).toBe("the lane matchup vs Teemo runs clearly against you (thin data — shrunk hard toward baseline)");
    expect(describeComponent("synergy", 0.01, 5000, "Yuumi")).toBe("pairing with Yuumi runs slightly in your favor");
    expect(describeComponent("baseline", -0.02, 90000, null)).toBe("this champion's overall below-average win rate in this role");
  });
});
