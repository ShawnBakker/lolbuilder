/**
 * AC-M7-11's test: inject a sentinel token, drive output through every
 * diagnostic path, assert the sentinel never appears.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { armRedaction, log, logError, redact } from "../src/sanitize.js";

const SENTINEL = "SENTINEL-TOKEN-a8f3kz";

afterEach(() => vi.restoreAllMocks());

describe("token redaction (AC-M7-11)", () => {
  it("redacts the token from strings, errors (message AND stack), and objects", () => {
    armRedaction(SENTINEL);
    expect(redact(`auth failed for riot:${SENTINEL}@127.0.0.1`)).not.toContain(SENTINEL);
    const err = new Error(`connect ECONNREFUSED riot:${SENTINEL}`);
    expect(redact(err)).not.toContain(SENTINEL);
    expect(redact({ headers: { Authorization: `Basic ${SENTINEL}` } })).not.toContain(SENTINEL);
  });

  it("log/logError never emit the token through console", () => {
    armRedaction(SENTINEL);
    const out = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errOut = vi.spyOn(console, "error").mockImplementation(() => undefined);
    log("lockfile:", `name:123:456:${SENTINEL}:https`, { password: SENTINEL });
    logError("request failed:", new Error(`401 for ${SENTINEL}`));
    const all = [...out.mock.calls, ...errOut.mock.calls].flat().join(" ");
    expect(all).not.toContain(SENTINEL);
    expect(all).toContain("[REDACTED-TOKEN]");
  });
});
