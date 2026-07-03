import { describe, expect, it } from "vitest";
import {
  ddragonToLive,
  ddragonToLolalytics,
  liveToDDragon,
  liveToLolalytics,
  lolalyticsToDDragon,
} from "../src/patch.js";

describe("patch translation (validated live 2026-07-02: 26.13 ↔ 16.13.1 ↔ 16.13)", () => {
  it("live → ddragon", () => {
    expect(liveToDDragon("26.13")).toBe("16.13.1");
    expect(liveToDDragon("26.1")).toBe("16.1.1");
  });

  it("ddragon → live", () => {
    expect(ddragonToLive("16.13.1")).toBe("26.13");
  });

  it("ddragon → lolalytics", () => {
    expect(ddragonToLolalytics("16.13.1")).toBe("16.13");
  });

  it("live → lolalytics", () => {
    expect(liveToLolalytics("26.13")).toBe("16.13");
  });

  it("lolalytics → ddragon", () => {
    expect(lolalyticsToDDragon("16.13")).toBe("16.13.1");
  });

  it("round-trips", () => {
    expect(ddragonToLive(liveToDDragon("26.13"))).toBe("26.13");
    expect(lolalyticsToDDragon(ddragonToLolalytics("16.13.1"))).toBe("16.13.1");
  });

  it("fails loudly on unexpected shapes instead of guessing", () => {
    expect(() => liveToDDragon("16.13.1")).toThrow(/format violation/);
    expect(() => ddragonToLive("26.13")).toThrow(/format violation/);
    expect(() => ddragonToLive("16.13")).toThrow(/format violation/);
    expect(() => liveToDDragon("lolpatch_3.9")).toThrow(/format violation/);
    expect(() => liveToDDragon("")).toThrow(/format violation/);
  });
});
