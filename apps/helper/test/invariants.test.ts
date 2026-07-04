/**
 * Source-level invariants, grep-enforced:
 * - AC-M7-3: read-only — no HTTP write verb anywhere in the helper source.
 * - AC-M7-11: no direct console usage outside sanitize.ts (the chokepoint).
 * - AC-M7-12: local-only — the only hosts in source are 127.0.0.1.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "src");
const sources = readdirSync(SRC).filter((f) => f.endsWith(".ts")).map((f) => ({ f, text: readFileSync(join(SRC, f), "utf8") }));

describe("helper source invariants", () => {
  it("read-only: no HTTP write verbs in any source file (AC-M7-3)", () => {
    for (const { f, text } of sources) {
      expect(text, f).not.toMatch(/method:\s*["'](POST|PUT|PATCH|DELETE)["']/i);
    }
  });

  it("all diagnostics route through sanitize.ts — no raw console elsewhere (AC-M7-11)", () => {
    for (const { f, text } of sources) {
      if (f === "sanitize.ts") continue;
      expect(text, f).not.toMatch(/console\.(log|error|warn|info|debug)/);
    }
  });

  it("local-only: no non-loopback host appears in source (AC-M7-12)", () => {
    for (const { f, text } of sources) {
      const hosts = text.match(/host:\s*["']([^"']+)["']/g) ?? [];
      for (const h of hosts) expect(h, f).toContain("127.0.0.1");
      // the only URL in source is the CORS origin constant (not a request target)
      const urls = (text.match(/https?:\/\/[^\s"'`]+/g) ?? []).filter((u) => !u.includes("127.0.0.1") && !u.includes("localhost"));
      expect(urls.filter((u) => !u.includes("shawnbakker.github.io")), f).toEqual([]);
    }
  });
});
