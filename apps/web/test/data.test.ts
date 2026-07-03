/**
 * AC-2 store mechanics under the subscription architecture: a tracked
 * champion's shard arrival notifies subscribers exactly once; failures
 * don't poison the cache; the stale check distinguishes its three states.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const MANIFEST = {
  patch: "16.13",
  ddragon: "16.13.1",
  generatedAt: "t",
  champions: [{ cid: 266, slug: "aatrox", name: "Aatrox" }],
  missing: [],
};
const SHARD = { champ: { cid: 266, slug: "aatrox", name: "Aatrox" } };

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) }) as Response;

async function freshData() {
  vi.resetModules();
  return import("../src/data.js");
}

beforeEach(() => vi.unstubAllGlobals());

describe("shard store (AC-2)", () => {
  it("trackLoaded fetches on first sight, notifies exactly once, getLoaded flips null->shard", async () => {
    const fetchSpy = vi.fn(async (url: string) =>
      url.endsWith("manifest.json") ? jsonResponse(MANIFEST) : jsonResponse(SHARD),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const data = await freshData();
    await data.loadManifest();
    const notify = vi.fn();
    data.subscribeLoaded(notify);
    expect(data.getLoaded(266)).toBeNull();
    data.trackLoaded(266);
    data.trackLoaded(266); // duplicate: no second fetch, no second notify
    await vi.waitFor(() => expect(data.getLoaded(266)).not.toBeNull());
    expect(notify).toHaveBeenCalledTimes(1);
    const shardFetches = fetchSpy.mock.calls.filter(([u]) => String(u).includes("aatrox"));
    expect(shardFetches.length).toBe(1);
  });

  it("a failed shard fetch stays null, doesn't notify, and can be retried", async () => {
    let fail = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("manifest.json")) return jsonResponse(MANIFEST);
        return fail ? jsonResponse({}, false) : jsonResponse(SHARD);
      }),
    );
    const data = await freshData();
    await data.loadManifest();
    const notify = vi.fn();
    data.subscribeLoaded(notify);
    data.trackLoaded(266);
    await new Promise((r) => setTimeout(r, 20));
    expect(data.getLoaded(266)).toBeNull();
    expect(notify).not.toHaveBeenCalled();
    fail = false;
    data.trackLoaded(266); // retry succeeds — failure didn't poison the cache
    await vi.waitFor(() => expect(data.getLoaded(266)).not.toBeNull());
    expect(notify).toHaveBeenCalledTimes(1);
  });
});

describe("stale check (AC-18 states)", () => {
  it("verified-stale vs verified-fresh vs unverifiable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(["16.14.1"])));
    let data = await freshData();
    expect(await data.checkStale("16.13")).toEqual({ stale: true, livePatch: "16.14" });
    expect(await data.checkStale("16.14")).toEqual({ stale: false, livePatch: "16.14" });

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    data = await freshData();
    expect(await data.checkStale("16.13")).toBeNull(); // -> soft warning banner
  });
});
