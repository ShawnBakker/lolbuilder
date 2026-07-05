/**
 * Source-level invariants, grep-enforced — RESCOPED at C.0 (spec AC-C-1b):
 * - The read-only hard line is about RIOT surfaces: `lcu.ts` is the sole
 *   module that talks to the LCU, and it must contain no write verb; no
 *   other module may make outgoing requests AT ALL. Incoming POST handling
 *   on our own local server (the calibration write channel) is a different
 *   category and explicitly permitted. The guarantee's meaning is
 *   unchanged — its wording is tightened to what it always meant.
 * - AC-M7-11: no direct console usage outside sanitize.ts (the chokepoint).
 * - AC-M7-12: local-only — the only request host in source is 127.0.0.1;
 *   the only filesystem writes are the calibration log (AC-M7-12's carved
 *   exception) and nothing else.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "src");
const sources = readdirSync(SRC).filter((f) => f.endsWith(".ts")).map((f) => ({ f, text: readFileSync(join(SRC, f), "utf8") }));

describe("helper source invariants (rescoped per AC-C-1b)", () => {
  it("read-only against Riot surfaces: lcu.ts (the sole outgoing-request module) contains no write verb", () => {
    const lcu = sources.find((s) => s.f === "lcu.ts")!;
    expect(lcu.text).not.toMatch(/method:\s*["'](POST|PUT|PATCH|DELETE)["']/i);
    expect(lcu.text).toMatch(/method:\s*["']GET["']/); // and is explicitly GET
  });

  it("no module besides lcu.ts makes outgoing requests (https/fetch)", () => {
    for (const { f, text } of sources) {
      if (f === "lcu.ts") continue;
      expect(text, f).not.toMatch(/https\.request|http\.request|\bfetch\(/);
    }
  });

  it("all diagnostics route through sanitize.ts — no raw console elsewhere (AC-M7-11)", () => {
    for (const { f, text } of sources) {
      if (f === "sanitize.ts") continue;
      expect(text, f).not.toMatch(/console\.(log|error|warn|info|debug)/);
    }
  });

  it("local-only: no non-loopback request host in source (AC-M7-12)", () => {
    for (const { f, text } of sources) {
      const hosts = text.match(/host:\s*["']([^"']+)["']/g) ?? [];
      for (const h of hosts) expect(h, f).toContain("127.0.0.1");
      const urls = (text.match(/https?:\/\/[^\s"'`)]+/g) ?? []).filter((u) => !u.includes("127.0.0.1") && !u.includes("localhost"));
      expect(urls.filter((u) => !u.includes("shawnbakker.github.io") && !u.includes("nodejs.org")), f).toEqual([]);
    }
  });

  it("the only filesystem WRITE lives in calibration-store.ts (the carved exception)", () => {
    for (const { f, text } of sources) {
      if (f === "calibration-store.ts") continue;
      expect(text, f).not.toMatch(/writeFileSync|appendFileSync|createWriteStream/);
    }
  });
});
