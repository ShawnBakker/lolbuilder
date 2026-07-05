/**
 * M7.4 integration tests: LcuProvider against a stubbed helper, driven
 * deterministically via pollOnce(). The two review-critical paths:
 * degraded mode IS the manual board (delegation, AC-M7-9), and a protocol
 * mismatch is surfaced + NOT consumed (AC-M7-14). Plus the full chain:
 * session → inference marking → override stickiness through poll updates
 * including the observed hover flicker.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const MANIFEST = {
  patch: "16.13",
  ddragon: "16.13.1",
  generatedAt: "t",
  champions: [
    { cid: 121, slug: "khazix", name: "Kha'Zix" },
    { cid: 14, slug: "sion", name: "Sion" },
    { cid: 266, slug: "aatrox", name: "Aatrox" },
  ],
  missing: [],
};
const KHAZIX_SHARD = {
  champ: { cid: 121, slug: "khazix", name: "Kha'Zix" },
  lanes: { top: 0.2, jungle: 99.3, middle: 0.2, bottom: 0.1, support: 0.1 },
};
const SION_SHARD = {
  champ: { cid: 14, slug: "sion", name: "Sion" },
  lanes: { top: 50, jungle: 5, middle: 40, bottom: 3, support: 2 }, // true flex: below bar
};

type HelperBody = Record<string, unknown>;
let helperBody: HelperBody | Error;

const cell = (cellId: number, championId = 0, assignedPosition = "") => ({ cellId, championId, assignedPosition });
const session = (theirTeam: unknown[], over: HelperBody = {}): HelperBody => ({
  state: "in-champ-select",
  protocol: 1,
  session: {
    myTeam: [cell(0, 222, "bottom"), cell(1, 18, "middle"), cell(2, 35, "jungle"), cell(3, 53, "utility"), cell(4, 875, "top")],
    theirTeam,
    localPlayerCellId: 0,
    timerPhase: "BAN_PICK",
    gameId: 111222333,
    queueId: 400,
  },
  ...over,
});

async function fresh() {
  vi.resetModules();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes("127.0.0.1:27437")) {
        if (helperBody instanceof Error) throw helperBody;
        return { ok: true, status: 200, json: () => Promise.resolve(helperBody) } as Response;
      }
      if (u.includes("data/manifest.json")) return { ok: true, status: 200, json: () => Promise.resolve(MANIFEST) } as Response;
      if (u.includes("/khazix.json")) return { ok: true, status: 200, json: () => Promise.resolve(KHAZIX_SHARD) } as Response;
      if (u.includes("/sion.json")) return { ok: true, status: 200, json: () => Promise.resolve(SION_SHARD) } as Response;
      return { ok: false, status: 404, json: () => Promise.resolve({}) } as Response;
    }),
  );
  const data = await import("../src/data.js");
  await data.loadManifest();
  const { ManualProvider } = await import("../src/provider.js");
  const { LcuProvider } = await import("../src/lcu-provider.js");
  const manual = new ManualProvider();
  const lcu = new LcuProvider(manual);
  return { manual, lcu, data };
}

beforeEach(() => vi.unstubAllGlobals());

describe("degradation is delegation (AC-M7-9) — degraded mode IS v1's manual board", () => {
  it("helper absent: every board operation hits the SAME manual provider, entries intact", async () => {
    helperBody = new Error("ECONNREFUSED");
    const { manual, lcu } = await fresh();
    await lcu.pollOnce();
    expect(lcu.status()).toEqual({ kind: "no-helper" });
    lcu.assign("ally", 0, 266); // through the LCU provider, degraded
    expect(manual.getDraftState()!.pick.cid).toBe(266); // landed in the manual board
    expect(lcu.slots()).toBe(manual.slots()); // literally the same slots
    expect(lcu.nextEmpty()).toEqual(manual.nextEmpty());
  });

  it("helper up but no client / not in champ select: named states, still delegating", async () => {
    helperBody = { state: "client-not-running" };
    const { lcu } = await fresh();
    await lcu.pollOnce();
    expect(lcu.status()).toEqual({ kind: "helper-no-client" });
    helperBody = { state: "not-in-champ-select" };
    await lcu.pollOnce();
    expect(lcu.status()).toEqual({ kind: "not-in-champ-select" });
    expect(lcu.getDraftState()).toBeNull(); // manual board empty -> null, not garbage
  });
});

describe("version handshake (AC-M7-14) — the weeks-later failure, tested now", () => {
  it("a stale helper's data is surfaced as an explained state and NOT consumed", async () => {
    helperBody = session([cell(5, 121)], { protocol: 999 });
    const { manual, lcu } = await fresh();
    await lcu.pollOnce();
    expect(lcu.status()).toEqual({ kind: "version-mismatch", helperProtocol: 999, expected: 1 });
    expect(lcu.slots()).toBe(manual.slots()); // the mismatched session never reached the board
  });

  it("check-and-prompt: an older-but-compatible helper keeps WORKING and surfaces an update prompt", async () => {
    helperBody = { state: "not-in-champ-select", helperVersion: "0.1.0", protocol: 1 };
    const { lcu } = await fresh();
    await lcu.pollOnce();
    expect(lcu.status()).toEqual({ kind: "not-in-champ-select" }); // advisory, not blocking
    expect(lcu.helperUpdate()).toEqual({ installed: "0.1.0", latest: "0.3.0" });
    helperBody = { state: "not-in-champ-select", helperVersion: "0.3.0", protocol: 1 };
    await lcu.pollOnce();
    expect(lcu.helperUpdate()).toBeNull(); // current helper: no prompt
  });
});

describe("live chain: session → inference → marking → scoring exclusion", () => {
  it("allies map from the game (you=slot 0, utility→support); enemies get inference or 'role needed'", async () => {
    helperBody = session([cell(5, 121), cell(6, 14), cell(7, 0)]);
    const { lcu, data } = await fresh();
    await lcu.pollOnce(); // reveals enemies, fires shard prefetch
    await vi.waitFor(() => expect(data.getLoaded(121)).not.toBeNull());
    await vi.waitFor(() => expect(data.getLoaded(14)).not.toBeNull());
    await lcu.pollOnce(); // shards loaded: inference now has priors

    const slots = lcu.slots();
    const you = slots.find((s) => s.side === "ally" && s.index === 0)!;
    expect(you.cid).toBe(222);
    expect(you.lane).toBe("bottom");
    expect(slots.find((s) => s.side === "ally" && s.cid === 53)!.lane).toBe("support"); // utility mapped

    const khazix = slots.find((s) => s.cid === 121)!;
    expect(khazix.lane).toBe("jungle");
    expect(khazix.inferred).toEqual({ share: 99.3 }); // visibly a guess, with evidence
    const sion = slots.find((s) => s.cid === 14)!;
    expect(sion.unknownRole).toBe(true); // 50/40 flex: below the bar, role needed

    const draft = lcu.getDraftState()!;
    expect(draft.pick.cid).toBe(222);
    expect(draft.enemies).toEqual([{ cid: 121, lane: "jungle" }]); // sion EXCLUDED until a human assigns
  });

  it("override sticks through poll updates, survives the observed hover flicker, clears on session end", async () => {
    helperBody = session([cell(5, 121)]);
    const { lcu, data } = await fresh();
    await lcu.pollOnce();
    await vi.waitFor(() => expect(data.getLoaded(121)).not.toBeNull());
    await lcu.pollOnce();

    // human corrects the inferred jungle to top (one action)
    lcu.setLane("enemy", 0, "top");
    let slot = lcu.slots().find((s) => s.cid === 121)!;
    expect(slot.lane).toBe("top");
    expect(slot.inferred).toBeUndefined(); // a human choice wears no guess badge

    await lcu.pollOnce(); // next poll, same champion: override sticks
    expect(lcu.slots().find((s) => s.cid === 121)!.lane).toBe("top");

    helperBody = session([cell(5, 14)]); // hover flicker to Sion
    await lcu.pollOnce();
    expect(lcu.slots().find((s) => s.side === "enemy" && s.index === 0)!.cid).toBe(14); // override does not apply to Sion

    helperBody = session([cell(5, 121)]); // flicker back
    await lcu.pollOnce();
    slot = lcu.slots().find((s) => s.cid === 121)!;
    expect(slot.lane).toBe("top"); // the correction survived the flicker
    expect(slot.inferred).toBeUndefined();

    helperBody = { state: "not-in-champ-select" }; // draft over
    await lcu.pollOnce();
    helperBody = session([cell(5, 121)]); // next draft, same champion
    await lcu.pollOnce();
    await lcu.pollOnce();
    slot = lcu.slots().find((s) => s.cid === 121)!;
    expect(slot.inferred).toEqual({ share: 99.3 }); // fresh session: back to inference, old override gone
  });

  it("REGRESSION (live 2026-07-04): shard arriving WITHOUT a session change must re-render the inference", async () => {
    // The Vel'Koz freeze: enemy locks -> shard not yet loaded -> 'role
    // needed' renders -> shard loads (session unchanged) -> the next poll
    // recomputes the inference but the old change-check saw 'no change'
    // and never notified React. The badge stayed stale on screen.
    helperBody = session([cell(5, 121)]);
    const { lcu, data } = await fresh();
    const notify = vi.fn();
    lcu.subscribe(notify);

    await lcu.pollOnce(); // enemy revealed; khazix shard NOT loaded yet
    expect(lcu.slots().find((s) => s.cid === 121)!.unknownRole).toBe(true);

    await vi.waitFor(() => expect(data.getLoaded(121)).not.toBeNull()); // shard lands; session identical
    notify.mockClear();
    await lcu.pollOnce(); // same session body — but derived slots changed
    expect(notify).toHaveBeenCalled(); // React MUST be told
    const slot = lcu.slots().find((s) => s.cid === 121)!;
    expect(slot.inferred).toEqual({ share: 99.3 });
    expect(slot.unknownRole).toBe(false);
  });

  it("the real 2026-07-04 comp: all five enemies infer, including the flex whose best lane clears the bar last", async () => {
    // Ezreal 95.8 bottom, Rengar 90.7 jungle, Jax 73.4 top, Akali 69.1 mid,
    // Vel'Koz support 63.6 — the greedy pass assigns ALL FIVE (Vel'Koz's
    // support clears the threshold once the other lanes are taken).
    const { inferEnemyRoles } = await import("@lolbuilder/core");
    const out = inferEnemyRoles([
      { cid: 81, lanes: { top: 0.5, jungle: 0.2, middle: 2.1, bottom: 95.8, support: 1.5 } },
      { cid: 84, lanes: { top: 30.5, jungle: 0, middle: 69.1, bottom: 0.2, support: 0.3 } },
      { cid: 24, lanes: { top: 73.4, jungle: 23.7, middle: 1, bottom: 0.2, support: 1.7 } },
      { cid: 107, lanes: { top: 6.1, jungle: 90.7, middle: 0, bottom: 0.8, support: 2.2 } },
      { cid: 161, lanes: { top: 2.2, jungle: 0, middle: 18.2, bottom: 16, support: 63.6 } },
    ]);
    expect(out).toHaveLength(5);
    expect(out.find((r) => r.cid === 161)).toEqual({ cid: 161, lane: "support", share: 63.6 });
  });

  it("assignment is read-only while live: champions come from the game", async () => {
    helperBody = session([cell(5, 121)]);
    const { manual, lcu } = await fresh();
    await lcu.pollOnce();
    lcu.assign("ally", 0, 266);
    expect(manual.getDraftState()).toBeNull(); // did NOT leak into the manual board
    expect(lcu.slots().find((s) => s.side === "ally" && s.index === 0)!.cid).toBe(222); // game data intact
  });
});
