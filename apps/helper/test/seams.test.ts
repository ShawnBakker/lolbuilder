/**
 * AC-M7-15: the seams exist, their interfaces are shaped, and NOTHING ships
 * behind them — asserting they throw keeps them honestly stubbed (a
 * half-implementation would fail this test and force the conversation).
 */
import { describe, expect, it } from "vitest";
import { appendCalibrationEntry, fetchMatchupBuild } from "../src/seams.js";

describe("seam stubs (AC-M7-15)", () => {
  it("matchup-build seam is shaped and unimplemented", () => {
    expect(() => fetchMatchupBuild({ ourSlug: "aatrox", theirSlug: "darius", patch: "16.13" })).toThrow(/not implemented/);
  });

  it("calibration-log seam is shaped and unimplemented", () => {
    expect(() =>
      appendCalibrationEntry({ gameId: 1, patch: "16.13", pickCid: 266, rating: 0.1, lockedAt: "t" }),
    ).toThrow(/not implemented/);
  });
});
