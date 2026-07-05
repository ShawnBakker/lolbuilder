/**
 * AC-M7-15: the seams exist, their interfaces are shaped, and NOTHING ships
 * behind them — asserting they throw keeps them honestly stubbed (a
 * half-implementation would fail this test and force the conversation).
 */
import { describe, expect, it } from "vitest";
import { fetchMatchupBuild } from "../src/seams.js";

describe("seam stubs (AC-M7-15)", () => {
  it("matchup-build seam is shaped and unimplemented", () => {
    expect(() => fetchMatchupBuild({ ourSlug: "aatrox", theirSlug: "darius", patch: "16.13" })).toThrow(/not implemented/);
  });

  // The calibration-log seam was REALIZED at C.0 — its tests live in
  // calibration-store.test.ts and server.test.ts now.
});
