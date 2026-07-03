/**
 * Golden-fixture tests (AC-10): the deserializer against real captured
 * payloads. Fixtures: aatrox/lulu build, aatrox counters (+vslane variant),
 * captured 2026-07-03 (patch 16.13); aatrox synergy captured 2026-07-02.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BUCKET_INDICES, LANES } from "@lolbuilder/types";
import {
  assertUniformRefEncoding,
  extractBaseline,
  extractGameLength,
  extractMatchups,
  extractSynergy,
  parsePayload,
} from "../src/index.js";

const FIXTURES = join(__dirname, "..", "fixtures");
const load = (name: string): unknown => JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));

const QDATA_FIXTURES = [
  "aatrox-build.q-data.json",
  "aatrox-counters.q-data.json",
  "aatrox-counters-vslane-middle.q-data.json",
  "lulu-build.q-data.json",
];

describe("q-data graph model", () => {
  for (const name of QDATA_FIXTURES) {
    it(`${name}: parses and is uniformly ref-encoded`, () => {
      const payload = parsePayload(load(name));
      expect(payload.objs.length).toBeGreaterThan(1000);
      expect(() => assertUniformRefEncoding(payload)).not.toThrow();
    });
  }
});

describe("game-length buckets (build payloads)", () => {
  for (const name of ["aatrox-build.q-data.json", "lulu-build.q-data.json"]) {
    it(`${name}: 7 buckets, wins ≤ games, plausible totals`, () => {
      const { time, timeWin } = extractGameLength(parsePayload(load(name)));
      let games = 0;
      let wins = 0;
      for (const k of BUCKET_INDICES) {
        expect(time[k]).toBeGreaterThan(0);
        expect(timeWin[k]).toBeLessThanOrEqual(time[k]);
        games += time[k];
        wins += timeWin[k];
      }
      const wr = wins / games;
      expect(wr).toBeGreaterThan(0.4);
      expect(wr).toBeLessThan(0.6);
    });
  }
});

describe("baseline stats (build payloads)", () => {
  it("aatrox: cid 266, top, plausible rates", () => {
    const b = extractBaseline(parsePayload(load("aatrox-build.q-data.json")));
    expect(b.cid).toBe(266);
    expect(b.lane).toBe("top");
    expect(b.patch).toMatch(/^\d{2}\.\d{1,2}$/);
    expect(b.n).toBeGreaterThan(1000);
    expect(b.wr).toBeGreaterThan(40);
    expect(b.wr).toBeLessThan(60);
  });

  it("lulu: cid 117, support", () => {
    const b = extractBaseline(parsePayload(load("lulu-build.q-data.json")));
    expect(b.cid).toBe(117);
    expect(b.lane).toBe("support");
  });
});

describe("matchup tables (counters payloads)", () => {
  for (const name of ["aatrox-counters.q-data.json", "aatrox-counters-vslane-middle.q-data.json"]) {
    it(`${name}: non-empty numeric rows with known lanes`, () => {
      const rows = extractMatchups(parsePayload(load(name)));
      expect(rows.length).toBeGreaterThan(20);
      for (const row of rows) {
        expect(Number.isFinite(row.vsWr)).toBe(true);
        expect(row.n).toBeGreaterThanOrEqual(1);
        expect(LANES).toContain(row.defaultLane);
      }
    });
  }

  it("vslane variant returns a different opponent set than the default", () => {
    const base = new Set(extractMatchups(parsePayload(load("aatrox-counters.q-data.json"))).map((r) => r.cid));
    const vs = extractMatchups(parsePayload(load("aatrox-counters-vslane-middle.q-data.json"))).map((r) => r.cid);
    expect(vs.some((cid) => !base.has(cid))).toBe(true);
  });
});

describe("synergy payload (mega build-team)", () => {
  it("aatrox-synergy.mega.json: header-driven rows for the four other roles", () => {
    const team = extractSynergy(load("aatrox-synergy.mega.json"));
    const roles = Object.keys(team);
    expect(roles.length).toBe(4);
    for (const rows of Object.values(team)) {
      expect(rows.length).toBeGreaterThan(50);
      for (const row of rows) {
        expect(Number.isInteger(row.id)).toBe(true);
        expect(row.n).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
