/**
 * AC-M7-7 / OI-M7-1: inference assigns only above the confidence bar;
 * ambiguity stays blank (the reviewer's third hard-look item). Real
 * distributions from the production dataset where noted.
 */
import { describe, expect, it } from "vitest";
import type { Lane } from "@lolbuilder/types";
import { INFERENCE_THRESHOLD, inferEnemyRoles } from "../src/index.js";

const dist = (over: Partial<Record<Lane, number>>): Record<Lane, number> => ({
  top: 0,
  jungle: 0,
  middle: 0,
  bottom: 0,
  support: 0,
  ...over,
});

// real production values
const KHAZIX = dist({ jungle: 99.3, top: 0.2, middle: 0.2, bottom: 0.1, support: 0.1 });
const AATROX = dist({ top: 78.9, jungle: 18.4, middle: 1.8, bottom: 0.1, support: 0.7 });

describe("inferEnemyRoles", () => {
  it("one-role mains and strong defaults auto-assign, with the share as evidence", () => {
    const out = inferEnemyRoles([
      { cid: 121, lanes: KHAZIX },
      { cid: 266, lanes: AATROX },
    ]);
    expect(out).toEqual([
      { cid: 121, lane: "jungle", share: 99.3 },
      { cid: 266, lane: "top", share: 78.9 },
    ]);
  });

  it("a true ~50/45 flex stays BLANK — blank beats confidently wrong (OI-M7-1)", () => {
    const flex = dist({ top: 50, middle: 45, jungle: 5 });
    expect(inferEnemyRoles([{ cid: 1, lanes: flex }])).toEqual([]);
    // and just over the bar assigns
    const leans = dist({ top: INFERENCE_THRESHOLD, middle: 35, jungle: 5 });
    expect(inferEnemyRoles([{ cid: 2, lanes: leans }])).toEqual([{ cid: 2, lane: "top", share: INFERENCE_THRESHOLD }]);
  });

  it("two jungle-mains: the more confident one gets jungle, the other stays blank rather than being dumped elsewhere", () => {
    const EVELYNN = dist({ jungle: 98.1, middle: 1.2, top: 0.4, bottom: 0.2, support: 0.1 });
    const out = inferEnemyRoles([
      { cid: 28, lanes: EVELYNN },
      { cid: 121, lanes: KHAZIX },
    ]);
    expect(out).toEqual([{ cid: 121, lane: "jungle", share: 99.3 }]); // 99.3 beats 98.1; Evelynn's next-best 1.2 stays blank
  });

  it("missing lanes data (pre-M7.0 shard / unloaded) means blank, never a guess", () => {
    expect(inferEnemyRoles([{ cid: 1 }, { cid: 121, lanes: KHAZIX }])).toEqual([
      { cid: 121, lane: "jungle", share: 99.3 },
    ]);
  });

  it("most-confident-first resolves contested lanes globally, not by input order", () => {
    // input order reversed: the higher-confidence champion still wins the lane
    const GAREN = dist({ top: 88, middle: 8, jungle: 4 });
    const out = inferEnemyRoles([
      { cid: 266, lanes: AATROX }, // 78.9 top
      { cid: 86, lanes: GAREN }, // 88 top — listed second, must still win top
    ]);
    expect(out[0]).toEqual({ cid: 86, lane: "top", share: 88 });
    expect(out.find((r) => r.cid === 266)).toBeUndefined(); // aatrox's jungle 18.4 < bar → blank
  });
});
