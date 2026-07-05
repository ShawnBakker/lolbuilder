/**
 * Source-level invariants, grep-enforced — rescoped at C.0 (AC-C-1b) and
 * again at C.1 (the Match-V5 read surface). The living statement:
 * - READ-ONLY AGAINST RIOT SURFACES (the hard line, meaning unchanged):
 *   outbound requests exist in exactly two modules — lcu.ts (loopback LCU)
 *   and riot.ts (official Match-V5 API) — and BOTH are GET-only. No other
 *   module makes any outbound request. Incoming POST handling on our own
 *   local server (the calibration write channel) is a different category,
 *   explicitly permitted.
 * - AC-M7-11: no direct console usage outside sanitize.ts; and the Riot
 *   key never reaches a log call.
 * - AC-M7-12: local-only serving; the only filesystem writes are the
 *   calibration log + outcomes file (the carved exception).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "src");
const sources = readdirSync(SRC).filter((f) => f.endsWith(".ts")).map((f) => ({ f, text: readFileSync(join(SRC, f), "utf8") }));

describe("helper source invariants (rescoped per AC-C-1b, extended at C.1)", () => {
  it("read-only against Riot surfaces: lcu.ts contains no write verb", () => {
    const lcu = sources.find((s) => s.f === "lcu.ts")!;
    expect(lcu.text).not.toMatch(/method:\s*["'](POST|PUT|PATCH|DELETE)["']/i);
    expect(lcu.text).toMatch(/method:\s*["']GET["']/); // and is explicitly GET
  });

  it("outbound requests exist in exactly two modules — lcu.ts and riot.ts — and riot.ts is GET-only against Riot's official hosts", () => {
    for (const { f, text } of sources) {
      if (f === "lcu.ts" || f === "riot.ts") continue;
      expect(text, f).not.toMatch(/https\.request|http\.request|\bfetch\(/);
    }
    const riot = sources.find((s) => s.f === "riot.ts")!;
    expect(riot.text).not.toMatch(/method:\s*["'](POST|PUT|PATCH|DELETE)["']/i); // fetch with no method option = GET
    const urls = riot.text.match(/https:\/\/[^\s"'`)]+/g) ?? [];
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(u, u).toMatch(/\.api\.riotgames\.com|developer\.riotgames\.com/);
  });

  it("all diagnostics route through sanitize.ts — no raw console elsewhere (AC-M7-11)", () => {
    for (const { f, text } of sources) {
      if (f === "sanitize.ts") continue;
      expect(text, f).not.toMatch(/console\.(log|error|warn|info|debug)/);
    }
  });

  it("the Riot key's VALUE never reaches a log call (no process.env interpolation in diagnostics)", () => {
    for (const f of ["riot.ts", "reconcile.ts"]) {
      const text = sources.find((s) => s.f === f)!.text;
      for (const m of text.match(/log(?:Error)?\([^;]*\)/gs) ?? []) {
        expect(m, `${f}: ${m.slice(0, 60)}`).not.toMatch(/process\.env/);
      }
    }
  });

  it("local-only serving: no non-loopback request host in source (AC-M7-12; Riot API + docs/site links excepted)", () => {
    for (const { f, text } of sources) {
      const hosts = text.match(/host:\s*["']([^"']+)["']/g) ?? [];
      for (const h of hosts) expect(h, f).toContain("127.0.0.1");
      const urls = (text.match(/https?:\/\/[^\s"'`)]+/g) ?? []).filter((u) => !u.includes("127.0.0.1") && !u.includes("localhost"));
      expect(
        urls.filter((u) => !u.includes("shawnbakker.github.io") && !u.includes("nodejs.org") && !u.includes(".api.riotgames.com") && !u.includes("developer.riotgames.com")),
        f,
      ).toEqual([]);
    }
  });

  it("filesystem WRITES live in exactly two modules: calibration-store.ts and reconcile.ts (the carved local-log exception)", () => {
    for (const { f, text } of sources) {
      if (f === "calibration-store.ts" || f === "reconcile.ts") continue;
      expect(text, f).not.toMatch(/writeFileSync|appendFileSync|createWriteStream/);
    }
  });
});
