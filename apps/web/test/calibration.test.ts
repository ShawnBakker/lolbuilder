/**
 * C.0 capture controller: fires once per (game, phase), retries until the
 * shard is available, never throws, never re-fires on repeated polls, and
 * a new game gets fresh captures.
 */
import { describe, expect, it, vi } from "vitest";
import type { DraftState, Shard } from "@lolbuilder/types";
import { CaptureController, type CaptureSource } from "../src/calibration.js";
import type { LiveMeta } from "../src/lcu-provider.js";

const SHARD = {
  champ: { cid: 266, slug: "aatrox", name: "Aatrox" },
  patch: "16.13",
  baseline: { cid: 266, lane: "top", defaultLane: "top", patch: "16.13", wr: 51.5, avgWr: 50, pr: 5, br: 3, n: 100_000 },
  matchupsVsLane: { top: [], jungle: [], middle: [], bottom: [], support: [] },
  synergy: {},
} as unknown as Shard;

const DRAFT: DraftState = { pick: { cid: 266, lane: "top" }, allies: [], enemies: [] };

const src = (meta: Partial<LiveMeta> | null, draft: DraftState | null = DRAFT): CaptureSource => ({
  liveMeta: () =>
    meta === null ? null : { gameId: 111, queueId: 400, phase: "BAN_PICK", ownChampionId: 0, enemiesVisible: 0, alliesVisible: 1, ...meta },
  getDraftState: () => draft,
});

describe("CaptureController", () => {
  it("at-pick fires exactly once when own champion locks, with the confirmed fields", async () => {
    const post = vi.fn((_body: unknown) => Promise.resolve({}));
    const c = new CaptureController(() => SHARD, post);
    c.onUpdate(src({ ownChampionId: 0 })); // still picking: nothing
    expect(post).not.toHaveBeenCalled();
    c.onUpdate(src({ ownChampionId: 266, enemiesVisible: 2 })); // locked
    c.onUpdate(src({ ownChampionId: 266, enemiesVisible: 3 })); // later poll: no re-fire
    expect(post).toHaveBeenCalledTimes(1);
    const body = post.mock.calls[0]![0] as Record<string, unknown>;
    expect(body["phase"]).toBe("at-pick");
    expect(body["gameId"]).toBe(111);
    expect(body["enemiesVisible"]).toBe(2); // conditions at CAPTURE time
    expect(typeof body["rating"]).toBe("number");
    expect(body["context"]).toEqual({ patch: "16.13", kMatchup: 25, kSynergy: 50 }); // rating provenance
  });

  it("finalization fires once (GAME_STARTING accepted as fallback), independent of at-pick", async () => {
    const post = vi.fn((_body: unknown) => Promise.resolve({}));
    const c = new CaptureController(() => SHARD, post);
    c.onUpdate(src({ ownChampionId: 266, phase: "FINALIZATION" }));
    c.onUpdate(src({ ownChampionId: 266, phase: "GAME_STARTING" }));
    expect(post).toHaveBeenCalledTimes(2); // at-pick + finalization, each once
    expect((post.mock.calls[1]![0] as Record<string, unknown>)["phase"]).toBe("finalization");
  });

  it("retries until the shard loads — the capture is late, not lost", () => {
    const post = vi.fn((_body: unknown) => Promise.resolve({}));
    let shard: Shard | null = null;
    const c = new CaptureController(() => shard, post);
    c.onUpdate(src({ ownChampionId: 266 })); // shard not loaded: skip, unsent
    expect(post).not.toHaveBeenCalled();
    shard = SHARD;
    c.onUpdate(src({ ownChampionId: 266 })); // next poll: fires
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("a new gameId gets fresh captures; non-live and invalid gameIds are ignored", () => {
    const post = vi.fn((_body: unknown) => Promise.resolve({}));
    const c = new CaptureController(() => SHARD, post);
    c.onUpdate(src(null)); // not live
    c.onUpdate(src({ gameId: 0, ownChampionId: 266 })); // pre-assigned id
    expect(post).not.toHaveBeenCalled();
    c.onUpdate(src({ gameId: 111, ownChampionId: 266 }));
    c.onUpdate(src({ gameId: 222, ownChampionId: 266 })); // next draft
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("a rejecting POST never throws — fire-and-forget is structural", async () => {
    const post = vi.fn((_body: unknown) => Promise.reject(new Error("old helper: no such route")));
    const c = new CaptureController(() => SHARD, post);
    expect(() => c.onUpdate(src({ ownChampionId: 266 }))).not.toThrow();
    await new Promise((r) => setTimeout(r, 10)); // let the rejection settle
  });
});
