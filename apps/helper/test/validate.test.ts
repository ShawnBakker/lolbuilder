/**
 * AC-M7-6: shape validation with named invariants. Fixtures are synthetic
 * (the real dumps carry players' identifiers and stay local-only), built to
 * the shape PC-M7-3 observed live.
 */
import { describe, expect, it } from "vitest";
import { validateSession } from "../src/validate.js";

const slot = (cellId: number, championId = 0, assignedPosition = "") => ({ cellId, championId, assignedPosition });

const GOOD = {
  myTeam: [slot(0, 266, "top"), slot(1, 64, "jungle")],
  theirTeam: [slot(5, 21), slot(6)],
  actions: [[{ type: "pick", championId: 21, completed: true, isAllyAction: false }]],
  timer: { phase: "BAN_PICK" },
  localPlayerCellId: 0,
  gameId: 5594749083,
  queueId: 400,
};

describe("validateSession (AC-M7-6)", () => {
  it("accepts the observed live shape and normalizes it", () => {
    const r = validateSession(GOOD);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.session.gameId).toBe(5594749083); // preserved for calibration (AC-C-1)
      expect(r.session.queueId).toBe(400);
      expect(r.session.theirTeam[0]!.championId).toBe(21);
      expect(r.session.timerPhase).toBe("BAN_PICK");
      expect(r.session.actions[0]![0]!.isAllyAction).toBe(false);
    }
  });

  it.each([
    ["session-shape", null],
    ["session-shape", [1, 2, 3]],
    ["team-shape", { ...GOOD, myTeam: "nope" }],
    ["team-shape", { ...GOOD, theirTeam: [{ cellId: "five", championId: 21 }] }],
    ["actions-shape", { ...GOOD, actions: { "0": [] } }],
    ["actions-shape", { ...GOOD, actions: [{ type: "pick" }] }],
    ["timer-shape", { ...GOOD, timer: { phase: 7 } }],
    ["timer-shape", { ...GOOD, timer: undefined }],
    ["session-shape", { ...GOOD, localPlayerCellId: "zero" }],
    ["session-shape", { ...GOOD, gameId: undefined }],
    ["session-shape", { ...GOOD, queueId: "ranked" }],
  ])("names the violated invariant: %s", (invariant, payload) => {
    const r = validateSession(payload);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.invariant).toBe(invariant);
  });
});
