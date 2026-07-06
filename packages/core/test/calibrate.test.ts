/**
 * C.2 property tests (plan DoD): known-ordering data → AUC > 0.5 with CI
 * excluding 0.5; shuffled labels → CI spanning 0.5; tie handling exact;
 * insufficiency honest; bootstrap deterministic under a seed.
 */
import { describe, expect, it } from "vitest";
import { analyzeCalibration, auc, mulberry32, reliabilityBuckets, type CalibrationSample } from "../src/calibrate.js";

const s = (rating: number, win: boolean): CalibrationSample => ({ rating, win });

describe("auc (Mann-Whitney, ties 0.5)", () => {
  it("hand-computed exact values", () => {
    expect(auc([s(0.3, true), s(-0.2, false)])).toBe(1); // winner rated higher
    expect(auc([s(-0.2, true), s(0.3, false)])).toBe(0); // winner rated lower
    expect(auc([s(0.1, true), s(0.1, false)])).toBe(0.5); // exact tie -> 0.5, not dropped
    // 2 wins x 2 losses: pairs (0.4>0.1)=1 (0.4>0.3)=1 (0.2>0.1)=1 (0.2<0.3)=0 -> 3/4
    expect(auc([s(0.4, true), s(0.2, true), s(0.3, false), s(0.1, false)])).toBe(0.75);
  });

  it("null without both classes — never a guessed number", () => {
    expect(auc([])).toBeNull();
    expect(auc([s(0.1, false), s(0.2, false)])).toBeNull(); // the CURRENT real log: 2 losses
    expect(auc([s(0.1, true)])).toBeNull();
  });
});

describe("analyzeCalibration (AUC + bootstrap CI, seeded)", () => {
  const strongSignal: CalibrationSample[] = Array.from({ length: 40 }, (_, i) =>
    i < 20 ? s(0.3 + i * 0.01, true) : s(-0.3 - i * 0.01, false),
  ); // perfectly ordered: every win rated above every loss

  const noise = (() => {
    const rng = mulberry32(42);
    return Array.from({ length: 40 }, (_, i) => s(rng() - 0.5, i % 2 === 0));
  })(); // ratings independent of outcomes

  it("strong ordering: AUC 1, CI excludes 0.5, never leaves [0,1]", () => {
    const a = analyzeCalibration(strongSignal);
    expect(a.auc).toBe(1);
    expect(a.pairs).toBe(400);
    expect(a.ci![0]).toBeGreaterThan(0.5); // conclusive under the CI, not the point estimate
    expect(a.ci![1]).toBeLessThanOrEqual(1);
    expect(a.insufficient).toBe(false);
  });

  it("shuffled labels: CI spans 0.5 — the honest inconclusive", () => {
    const a = analyzeCalibration(noise);
    expect(a.ci![0]).toBeLessThan(0.5);
    expect(a.ci![1]).toBeGreaterThan(0.5);
  });

  it("deterministic under a seed; different seeds differ", () => {
    const a = analyzeCalibration(noise, { rng: mulberry32(7) });
    const b = analyzeCalibration(noise, { rng: mulberry32(7) });
    const c = analyzeCalibration(noise, { rng: mulberry32(8) });
    expect(a.ci).toEqual(b.ci);
    expect(a.ci).not.toEqual(c.ci);
  });

  it("insufficiency is a named state carrying the counts (AC-C-8's honest floor)", () => {
    const a = analyzeCalibration([s(-0.17, false), s(-0.27, false)]); // literally today's log
    expect(a).toMatchObject({ n: 2, wins: 0, losses: 2, pairs: 0, auc: null, ci: null, insufficient: true });
  });
});

describe("reliabilityBuckets (≤3, equal-count)", () => {
  it("terciles by rating with win counts; never more than 3", () => {
    const samples = Array.from({ length: 9 }, (_, i) => s(i / 10, i >= 5));
    const buckets = reliabilityBuckets(samples);
    expect(buckets).toHaveLength(3);
    expect(buckets.map((b) => b.n)).toEqual([3, 3, 3]);
    expect(buckets[0]!.wins).toBe(0); // lowest-rated third: ratings 0-0.2 (i 0-2)
    expect(buckets[2]!.wins).toBe(3); // highest third all wins
  });

  it("degenerate sizes stay honest: fewer samples than buckets", () => {
    expect(reliabilityBuckets([s(0.1, true)])).toHaveLength(1);
    expect(reliabilityBuckets([])).toEqual([]);
  });
});
