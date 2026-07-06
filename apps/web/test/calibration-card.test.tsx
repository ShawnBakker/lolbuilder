/**
 * C.3 rendered-state tests (plan DoD): n=0, below-floor, above-floor
 * inconclusive, synthetic conclusive, no-helper — and the structural
 * misread guard (AC-C-11): below the floor there is NO estimate, and the
 * card never renders a percent sign in ANY state (the closed-key-set
 * analog for the report card).
 */
// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalibrationCard, DISPLAY_FLOOR } from "../src/CalibrationCard.js";

const entry = (gameId: number, rating: number) => ({ gameId, phase: "finalization", rating });
const outcome = (gameId: number, win: boolean) => ({ gameId, win });

function stubHelper(data: unknown | Error) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (data instanceof Error) throw data;
      return { ok: true, status: 200, json: () => Promise.resolve(data) } as Response;
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const cardText = () => document.querySelector(".calibration")!.textContent!;

describe("CalibrationCard (C.3)", () => {
  it("no helper: names the reason, shows nothing that looks like data", async () => {
    stubHelper(new Error("ECONNREFUSED"));
    render(<CalibrationCard />);
    await waitFor(() => expect(screen.getByText(/helper isn't running/i)).toBeTruthy());
    expect(cardText()).not.toContain("%");
  });

  it("n=0: counter shows zero, verdict is 'too small to conclude', bar spans everything", async () => {
    stubHelper({ entries: [], outcomes: [] });
    render(<CalibrationCard />);
    await waitFor(() => expect(screen.getByTestId("counter").textContent).toContain("0 games logged"));
    expect(cardText()).toContain("too small to conclude");
    const fill = document.querySelector(".ci-bar .fill") as HTMLElement;
    expect(fill.style.width).toBe("100%"); // the range covers all answers
  });

  it("below the floor (the CURRENT real state): counts shown, NO estimate anywhere (AC-C-11)", async () => {
    stubHelper({
      entries: [entry(1, -0.17), entry(2, -0.27)],
      outcomes: [outcome(1, false), outcome(2, false)],
    });
    render(<CalibrationCard />);
    await waitFor(() => expect(screen.getByTestId("counter").textContent).toContain("2 games logged"));
    expect(screen.getByTestId("counter").textContent).toContain("0W/2L");
    expect(cardText()).toContain("too small to conclude");
    expect(cardText()).not.toMatch(/Ordering score/); // no estimate below the floor
    expect(cardText()).not.toContain("%"); // never a percentage, in any state
  });

  it("above the floor but noisy: CI spans 0.50 -> 'inconclusive' verdict, estimate shown WITH its range", async () => {
    const n = DISPLAY_FLOOR + 10;
    const entries = Array.from({ length: n }, (_, i) => entry(i, (i % 7) / 10 - 0.3));
    const outcomes_ = Array.from({ length: n }, (_, i) => outcome(i, i % 2 === 0)); // outcomes independent of rating
    stubHelper({ entries, outcomes: outcomes_ });
    render(<CalibrationCard />);
    await waitFor(() => expect(cardText()).toMatch(/Inconclusive/));
    expect(cardText()).toMatch(/Ordering score 0\.\d\d, plausible range/); // never a bare point estimate
    expect(cardText()).toContain("0.50 = no signal");
    expect(cardText()).not.toContain("%");
  });

  it("synthetic conclusive: every win rated above every loss -> distinguishable-from-chance verdict", async () => {
    const n = DISPLAY_FLOOR + 20;
    const entries = Array.from({ length: n }, (_, i) => entry(i, i < n / 2 ? 0.3 + i / 100 : -0.3 - i / 100));
    const outcomes_ = Array.from({ length: n }, (_, i) => outcome(i, i < n / 2));
    stubHelper({ entries, outcomes: outcomes_ });
    render(<CalibrationCard />);
    await waitFor(() => expect(cardText()).toMatch(/distinguishable from chance/));
    expect(cardText()).not.toContain("%");
  });

  it("leads with non-attribution before any number (AC-C-13)", async () => {
    stubHelper({ entries: [], outcomes: [] });
    render(<CalibrationCard />);
    await waitFor(() => expect(cardText()).toMatch(/one input among many/));
    const text = cardText();
    expect(text.indexOf("one input among many")).toBeLessThan(text.indexOf("games logged"));
  });
});
