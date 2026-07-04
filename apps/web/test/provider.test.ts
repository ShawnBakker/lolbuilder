/**
 * AC-1 seam mechanics under the subscription architecture (post-rewrite
 * regression guard): DraftState only via getDraftState(), notifications
 * fire per mutation, version is monotonic, auto-advance order is sane.
 */
import { describe, expect, it, vi } from "vitest";
import { ManualProvider, type BoardSource } from "../src/provider.js";

describe("ManualProvider (AC-1)", () => {
  it("returns null until the pick slot is assigned; then a DraftState with only filled slots", () => {
    const p = new ManualProvider();
    expect(p.getDraftState()).toBeNull();
    p.assign("enemy", 0, 122); // enemies alone don't make a draft
    expect(p.getDraftState()).toBeNull();
    p.assign("ally", 0, 266);
    const d = p.getDraftState()!;
    expect(d.pick).toEqual({ cid: 266, lane: "top" });
    expect(d.allies).toEqual([]); // empty ally slots excluded
    expect(d.enemies).toEqual([{ cid: 122, lane: "top" }]);
  });

  it("notifies subscribers on every mutation and bumps a monotonic version", () => {
    const p = new ManualProvider();
    const spy = vi.fn();
    const unsub = p.subscribe(spy);
    const v0 = p.version();
    p.assign("ally", 0, 266);
    p.setLane("ally", 0, "middle");
    p.assign("ally", 0, null);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(p.version()).toBe(v0 + 3);
    unsub();
    p.assign("ally", 0, 266);
    expect(spy).toHaveBeenCalledTimes(3); // unsubscribed
  });

  it("lane reassignment flows into DraftState (flex support)", () => {
    const p = new ManualProvider();
    p.assign("ally", 0, 266);
    p.assign("enemy", 2, 79);
    p.setLane("enemy", 2, "support"); // flexed
    expect(p.getDraftState()!.enemies).toEqual([{ cid: 79, lane: "support" }]);
  });

  it("BoardSource contract (AC-M7-1b): ManualProvider satisfies it, and a second implementation can drive the same consumers", () => {
    // Type-level: ManualProvider IS a BoardSource (compile fails otherwise).
    const manual: BoardSource = new ManualProvider();
    expect(manual.getDraftState()).toBeNull();

    // Runtime: a minimal fake proves the contract is implementable without
    // ManualProvider's internals — the seam LcuProvider slots into (M7.4).
    const fake: BoardSource = {
      version: () => 1,
      slots: () => [{ side: "ally", index: 0, lane: "top", cid: 266 }],
      assign: () => undefined,
      setLane: () => undefined,
      nextEmpty: () => null,
      getDraftState: () => ({ pick: { cid: 266, lane: "top" }, allies: [], enemies: [] }),
      subscribe: () => () => undefined,
    };
    expect(fake.getDraftState()!.pick.cid).toBe(266);
    expect(fake.slots()[0]!.cid).toBe(266);
  });

  it("nextEmpty advances allies-then-enemies and skips filled slots", () => {
    const p = new ManualProvider();
    expect(p.nextEmpty()).toEqual({ side: "ally", index: 0 });
    p.assign("ally", 0, 1);
    p.assign("ally", 1, 2);
    p.assign("ally", 3, 4); // gap at ally 2
    expect(p.nextEmpty()).toEqual({ side: "ally", index: 2 });
    p.assign("ally", 2, 3);
    p.assign("ally", 4, 5);
    expect(p.nextEmpty()).toEqual({ side: "enemy", index: 0 });
    for (let i = 0; i < 5; i++) p.assign("enemy", i, 10 + i);
    expect(p.nextEmpty()).toBeNull(); // full board
  });
});
