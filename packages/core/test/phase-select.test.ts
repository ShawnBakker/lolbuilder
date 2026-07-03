import { describe, expect, it } from "vitest";
import type { DraftState, Shard } from "@lolbuilder/types";
import { PHASE_FLOOR_N, phaseBreakdown, selectCells } from "../src/index.js";

const buckets = (vals: number[]) =>
  Object.fromEntries(vals.map((v, i) => [String(i + 1), v])) as Record<
    "1" | "2" | "3" | "4" | "5" | "6" | "7",
    number
  >;

describe("phaseBreakdown (AC-15/16)", () => {
  it("groups buckets 1–2 / 3–4 / 5–7 and shrinks toward baseline", () => {
    const gl = {
      time: buckets([100, 200, 400, 400, 300, 200, 100]),
      timeWin: buckets([40, 90, 210, 210, 160, 105, 50]),
    };
    const p = phaseBreakdown(gl, 50, 0);
    expect(p.early.games).toBe(300);
    expect(p.mid.games).toBe(800);
    expect(p.late.games).toBe(600);
    expect(p.early.wr).toBeCloseTo((130 / 300) * 100, 6);
  });

  it("renders below-floor phases as 'insufficient', never a number", () => {
    const gl = {
      time: buckets([10, 20, 400, 400, 300, 200, 100]),
      timeWin: buckets([5, 10, 210, 210, 160, 105, 50]),
    };
    const p = phaseBreakdown(gl, 50, 50);
    expect(p.early.games).toBeLessThan(PHASE_FLOOR_N);
    expect(p.early.wr).toBe("insufficient");
    expect(typeof p.mid.wr).toBe("number");
  });
});

const shard = (cid: number): Shard => ({
  champ: { cid, slug: "x", name: "X" },
  patch: "16.13",
  baseline: { cid, lane: "top", defaultLane: "top", patch: "16.13", wr: 51, avgWr: 50, pr: 5, br: 3, n: 50_000 },
  gameLength: { time: buckets([1, 1, 1, 1, 1, 1, 1]), timeWin: buckets([1, 1, 1, 1, 1, 1, 1]) },
  matchups: [{ cid: 900, vsWr: 55, n: 500, d1: 5, d2: 3, allWr: 50, defaultLane: "top" }],
  matchupsVsLane: {
    top: [{ cid: 900, vsWr: 55, n: 500, d1: 5, d2: 3, allWr: 50, defaultLane: "top" }],
    jungle: [],
    middle: [{ cid: 901, vsWr: 48, n: 300, d1: -2, d2: -3, allWr: 50, defaultLane: "top" }],
    bottom: [],
    support: [],
  },
  synergy: { jungle: [{ id: 64, wr: 52, d1: 1, d2: 0.5, pr: 7, n: 900 }] },
});

describe("selectCells (Gap B / AC-3)", () => {
  const draft: DraftState = {
    pick: { cid: 1, lane: "top" },
    allies: [{ cid: 64, lane: "jungle" }],
    enemies: [
      { cid: 900, lane: "top" },
      { cid: 901, lane: "middle" }, // a top-default champ FLEXED middle
      { cid: 902, lane: "support" },
    ],
  };

  it("selects cross-lane cells by assigned lane, never same-lane substitution", () => {
    const cells = selectCells(draft, shard(1));
    expect(cells.matchups).toEqual([
      { cid: 900, wr: 55, n: 500 },
      { cid: 901, wr: 48, n: 300 }, // from matchupsVsLane.middle
    ]);
    expect(cells.synergies).toEqual([{ cid: 64, wr: 52, n: 900 }]);
    expect(cells.missing).toEqual([{ kind: "matchup", cid: 902 }]);
  });

  it("refuses a shard for the wrong champion", () => {
    expect(() => selectCells(draft, shard(7))).toThrow(/cid 7/);
  });
});
