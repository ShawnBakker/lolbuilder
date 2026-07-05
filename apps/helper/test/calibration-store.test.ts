/**
 * The calibration store (spec AC-C-2/C-3): append-only, idempotent per
 * (gameId, phase), matchmade-only at the door, survives restarts (the
 * idempotency index rebuilds from the file).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CALIBRATION_SCHEMA } from "@lolbuilder/types";
import { CalibrationStore, validateEntry } from "../src/calibration-store.js";

let dir: string;
const fresh = () => {
  dir = mkdtempSync(join(tmpdir(), "calib-"));
  return new CalibrationStore(dir);
};
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const entry = (over: Record<string, unknown> = {}) => ({
  schema: CALIBRATION_SCHEMA,
  gameId: 5594749083,
  queueId: 400,
  phase: "at-pick",
  rating: 0.113,
  draft: { pick: { cid: 53, lane: "support" }, allies: [], enemies: [] },
  enemiesVisible: 2,
  alliesVisible: 4,
  lockedAt: "2026-07-04T21:00:00Z",
  context: { patch: "16.13", kMatchup: 25, kSynergy: 50 },
  ...over,
});

describe("CalibrationStore", () => {
  it("logs a valid matchmade entry, enriched with platform + receivedAt + preserving all fields", () => {
    const store = fresh();
    expect(store.append(entry(), "NA1")).toEqual({ state: "logged" });
    const line = JSON.parse(readFileSync(store.file, "utf8").trim()) as Record<string, unknown>;
    expect(line["gameId"]).toBe(5594749083);
    expect(line["platform"]).toBe("NA1");
    expect(line["schema"]).toBe(CALIBRATION_SCHEMA);
    expect(line["enemiesVisible"]).toBe(2);
    expect(typeof line["receivedAt"]).toBe("string");
  });

  it("idempotent per (gameId, phase) — and the index survives a restart", () => {
    const store = fresh();
    store.append(entry(), "NA1");
    expect(store.append(entry(), "NA1")).toEqual({ state: "duplicate" });
    expect(store.append(entry({ phase: "finalization" }), "NA1")).toEqual({ state: "logged" }); // other phase logs
    const reopened = new CalibrationStore(dir); // helper restarted
    expect(reopened.append(entry(), "NA1")).toEqual({ state: "duplicate" });
    expect(readFileSync(store.file, "utf8").trim().split("\n")).toHaveLength(2);
  });

  it("rejects non-matchmade queues by name — customs never enter the sample (AC-C-3)", () => {
    const store = fresh();
    expect(store.append(entry({ queueId: 3140 }), "NA1")).toEqual({ state: "rejected-queue", queueId: 3140 });
    expect(existsSync(store.file) && readFileSync(store.file, "utf8").trim()).toBeFalsy();
  });

  it("platform:null entries still log (fail-soft — C.1 skips them loudly)", () => {
    const store = fresh();
    expect(store.append(entry(), null)).toEqual({ state: "logged" });
    expect((JSON.parse(readFileSync(store.file, "utf8").trim()) as Record<string, unknown>)["platform"]).toBeNull();
  });

  it.each([
    ["entry-schema", { schema: 99 }],
    ["entry-gameid", { gameId: 0 }],
    ["entry-phase", { phase: "mid-draft" }],
    ["entry-rating", { rating: Infinity }],
    ["entry-visibility", { enemiesVisible: "two" }],
    ["entry-timestamp", { lockedAt: 12345 }],
    ["entry-context", { context: { patch: "16.13" } }],
    ["entry-context", { context: null }],
  ])("names the violated invariant: %s", (invariant, over) => {
    const v = validateEntry(entry(over));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.invariant).toBe(invariant);
  });
});
