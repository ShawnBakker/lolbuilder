/**
 * AC-14 property tests: pure functions, monotone in matchup WR, extreme
 * low-n convergence to baseline. Deterministic grid sweeps (no randomness —
 * a failing case must reproduce).
 */
import { describe, expect, it } from "vitest";
import { logitPct, scorePick, shrinkWr } from "../src/index.js";

const BASE = { wr: 51.5, n: 100_000 };

const cellsWith = (matchupWr: number, n: number) => ({
  baseline: BASE,
  matchups: [{ cid: 1, wr: matchupWr, n }],
  synergies: [],
  missing: [],
});

describe("shrinkWr", () => {
  it("interpolates between observation and baseline by n/(n+k)", () => {
    expect(shrinkWr(100, 50, 50, 50)).toBe(75);
    expect(shrinkWr(60, 0, 50, 50)).toBe(50);
    expect(shrinkWr(60, 1_000_000, 50, 50)).toBeCloseTo(60, 2);
  });
  it("k=0 is the identity on observed data", () => {
    expect(shrinkWr(37.3, 10, 50, 0)).toBeCloseTo(37.3, 10);
  });
});

describe("logitPct", () => {
  it("is 0 at 50%, antisymmetric, and rejects the boundary", () => {
    expect(logitPct(50)).toBeCloseTo(0, 12);
    expect(logitPct(60)).toBeCloseTo(-logitPct(40), 12);
    expect(() => logitPct(0)).toThrow();
    expect(() => logitPct(100)).toThrow();
  });
});

describe("scorePick properties", () => {
  it("rating is monotone in matchup WR (grid sweep, several n)", () => {
    for (const n of [10, 101, 1_000, 50_000]) {
      let prev = -Infinity;
      for (let wr = 30; wr <= 70; wr += 2.5) {
        const { rating } = scorePick(cellsWith(wr, n));
        expect(rating).toBeGreaterThan(prev);
        prev = rating;
      }
    }
  });

  it("extreme low-n inputs converge to the baseline-only rating", () => {
    const baselineOnly = scorePick({ baseline: BASE, matchups: [], synergies: [], missing: [] }).rating;
    // n=1 at 100% WR — the live-data case that makes shrinkage mandatory
    const spiked = scorePick({
      baseline: BASE,
      matchups: [],
      synergies: [{ cid: 2, wr: 100, n: 1 }],
      missing: [],
    }).rating;
    expect(Math.abs(spiked - baselineOnly)).toBeLessThan(0.09);
    const zeroN = scorePick({
      baseline: BASE,
      matchups: [{ cid: 3, wr: 100, n: 0 }],
      synergies: [],
      missing: [],
    }).rating;
    expect(zeroN).toBeCloseTo(baselineOnly, 12);
  });

  it("components sum exactly to the rating and expose per-cell deltas", () => {
    const score = scorePick({
      baseline: BASE,
      matchups: [{ cid: 1, wr: 55, n: 500 }],
      synergies: [{ cid: 2, wr: 53, n: 800 }],
      missing: [{ kind: "matchup", cid: 9 }],
    });
    const sum = score.components.reduce((a, c) => a + c.delta, 0);
    expect(sum).toBeCloseTo(score.rating, 12);
    expect(score.components.map((c) => c.kind)).toEqual(["baseline", "matchup", "synergy"]);
    expect(score.missing).toEqual([{ kind: "matchup", cid: 9 }]);
  });

  it("confidence derives from the min n across consumed cells", () => {
    const s = scorePick({
      baseline: BASE,
      matchups: [{ cid: 1, wr: 52, n: 150 }],
      synergies: [{ cid: 2, wr: 52, n: 5_000 }],
      missing: [],
    });
    expect(s.confidence).toEqual({ minN: 150, level: "low" });
  });

  it("API names the composite `rating` and exposes no probability field", () => {
    const s = scorePick(cellsWith(55, 500)) as unknown as Record<string, unknown>;
    expect("rating" in s).toBe(true);
    expect(Object.keys(s).some((k) => /prob/i.test(k))).toBe(false);
  });
});
