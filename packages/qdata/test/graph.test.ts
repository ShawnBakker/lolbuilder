/**
 * Synthetic unit tests for the graph mechanics and named invariants (AC-9):
 * every violation path fails loudly with the violated assumption named.
 */
import { describe, expect, it } from "vitest";
import {
  QDataFormatViolation,
  assertUniformRefEncoding,
  extractGameLength,
  extractSynergy,
  materialize,
  parsePayload,
  resolveRef,
} from "../src/index.js";

// _objs: 0:"1" (a VALUE that looks like a ref) 1:42 2:{a:"0",b:"1"} 3:[ "1", "0" ]
const MINI = { _entry: "2", _objs: ["1", 42, { a: "0", b: "1" }, ["1", "0"]] };

describe("graph resolution", () => {
  it("resolves refs single-hop: a resolved string is a value, never re-chased", () => {
    const p = parsePayload(MINI);
    // field a → ref "0" → the string "1"; must NOT be chased on to objs[1]=42
    expect(materialize(p, p.objs[2])).toEqual({ a: "1", b: 42 });
    expect(materialize(p, p.objs[3])).toEqual([42, "1"]);
    expect(resolveRef(p, "1")).toBe(42);
  });

  it("names the invariant on non-canonical, out-of-range, and non-string slots", () => {
    const p = parsePayload(MINI);
    expect(() => resolveRef(p, "0a")).toThrowError(/ref-canonical/);
    expect(() => resolveRef(p, "A")).toThrowError(/ref-canonical/);
    expect(() => resolveRef(p, "zz")).toThrowError(/ref-canonical/);
    expect(() => materialize(p, { bad: 7 })).toThrowError(/container-slot-ref/);
    const literal = parsePayload({ _entry: "0", _objs: [{ n: 150 }] });
    expect(() => assertUniformRefEncoding(literal)).toThrowError(/container-slot-ref/);
  });

  it("rejects malformed roots", () => {
    expect(() => parsePayload(null)).toThrowError(QDataFormatViolation);
    expect(() => parsePayload({ _objs: [] })).toThrowError(/root-/);
    expect(() => parsePayload({ _entry: "0" })).toThrowError(/root-objs/);
  });
});

describe("game-length invariants", () => {
  // buckets 1–7 → refs to numbers; entry 0 unused filler value
  const buckets = (over: Record<string, string> = {}) => {
    const time = { "1": "2", "2": "2", "3": "2", "4": "2", "5": "2", "6": "2", "7": "2", ...over };
    const timeWin = { "1": "3", "2": "3", "3": "3", "4": "3", "5": "3", "6": "3", "7": "3" };
    return parsePayload({ _entry: "0", _objs: ["x", { time: "4", timeWin: "5" }, 100, 60, time, timeWin] });
  };

  it("accepts a well-formed bucket host and enforces wins ≤ games", () => {
    const ok = extractGameLength(buckets());
    expect(ok.time["4"]).toBe(100);
    expect(ok.timeWin["4"]).toBe(60);
    const flipped = parsePayload({
      _entry: "0",
      _objs: [
        "x",
        { time: "4", timeWin: "5" },
        100,
        60,
        { "1": "3", "2": "3", "3": "3", "4": "3", "5": "3", "6": "3", "7": "3" }, // games = 60
        { "1": "2", "2": "2", "3": "2", "4": "2", "5": "2", "6": "2", "7": "2" }, // wins = 100
      ],
    });
    expect(() => extractGameLength(flipped)).toThrowError(/wins-le-games/);
  });

  it("rejects missing/extra buckets by name", () => {
    const short = parsePayload({
      _entry: "0",
      _objs: ["x", { time: "3", timeWin: "4" }, 5, { "1": "2", "2": "2" }, { "1": "2", "2": "2" }],
    });
    expect(() => extractGameLength(short)).toThrowError(/time-buckets/);
  });

  it("rejects a payload with no bucket host", () => {
    expect(() => extractGameLength(parsePayload({ _entry: "0", _objs: [{ other: "0" }] }))).toThrowError(/time-host/);
  });
});

describe("synergy invariants", () => {
  const base = {
    team_h: ["id", "wr", "d1", "d2", "pr", "n"],
    team: { jungle: [[64, 51.2, -0.2, 0.3, 7.2, 7905]] },
    response: { valid: true, duration: "1" },
  };

  it("parses via the header, tolerating column reorder", () => {
    const reordered = {
      ...base,
      team_h: ["n", "id", "wr", "d1", "d2", "pr"],
      team: { jungle: [[7905, 64, 51.2, -0.2, 0.3, 7.2]] },
    };
    const rows = extractSynergy(reordered).jungle!;
    expect(rows[0]).toEqual({ id: 64, wr: 51.2, d1: -0.2, d2: 0.3, pr: 7.2, n: 7905 });
  });

  it("names missing columns", () => {
    expect(() => extractSynergy({ ...base, team_h: ["id", "wr"] })).toThrowError(/synergy-columns/);
  });

  it("rejects unknown roles and short rows", () => {
    expect(() => extractSynergy({ ...base, team: { mid: [[1, 2, 3, 4, 5, 6]] } })).toThrowError(/synergy-lane/);
    expect(() => extractSynergy({ ...base, team: { jungle: [[1, 2]] } })).toThrowError(/synergy-row-shape/);
  });
});
