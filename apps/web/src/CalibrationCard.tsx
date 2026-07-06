/**
 * C.3 — the patient report card (spec AC-C-10..13).
 *
 * The load-bearing properties, all structural (tested, not styled):
 * - The CI is the headline; a point estimate never appears without it
 *   (analyzeCalibration can't return one) and never appears AT ALL below
 *   the display floor (OI-C-1: no estimate under 20 outcomes).
 * - The misread guard (AC-C-11): below the floor the card says "sample too
 *   small to conclude" with the range bar spanning everything, and no
 *   percent sign is rendered anywhere in this card — the ordering score is
 *   a 0–1 number against its 0.50 reference, not an accuracy percentage.
 * - Leads with what it can't attribute (AC-C-13), before any number.
 * - The counter + the visibly narrowing range are the honesty story
 *   (AC-C-12): floors are display gates, not trust thresholds — no state
 *   change at any game count reads as "now meaningful."
 */
import { useEffect, useState } from "react";
import { analyzeCalibration, type CalibrationAnalysis, type CalibrationSample } from "@lolbuilder/core";
import { HELPER_URL } from "./lcu-provider.js";

/** OI-C-1: below this many outcomes, no estimate is shown at all. */
export const DISPLAY_FLOOR = 20;

interface CalData {
  entries: Array<Record<string, unknown>>;
  outcomes: Array<Record<string, unknown>>;
}

export function joinSamples(data: CalData): { samples: CalibrationSample[]; games: number; pendingOutcomes: number } {
  const results = new Map(
    data.outcomes.filter((o) => typeof o["win"] === "boolean").map((o) => [o["gameId"] as number, o["win"] as boolean]),
  );
  const samples: CalibrationSample[] = data.entries
    .filter((e) => e["phase"] === "finalization" && results.has(e["gameId"] as number))
    .map((e) => ({ rating: e["rating"] as number, win: results.get(e["gameId"] as number)! }));
  const games = new Set(data.entries.map((e) => e["gameId"])).size;
  return { samples, games, pendingOutcomes: games - results.size };
}

function RangeBar({ a }: { a: CalibrationAnalysis | null }) {
  // null analysis (below floor / insufficient) renders the bar spanning
  // everything: the honest "the plausible range covers all answers".
  const lo = a?.ci ? a.ci[0] : 0;
  const hi = a?.ci ? a.ci[1] : 1;
  return (
    <div className="ci-bar" title="The shaded range is what the data still allows. The center line is 0.50 — no ordering signal. Conclusions live entirely in whether the range excludes that line.">
      <span className="fill" style={{ left: `${lo * 100}%`, width: `${Math.max(1.5, (hi - lo) * 100)}%` }} />
      <span className="mid" />
    </div>
  );
}

export function CalibrationCard() {
  const [data, setData] = useState<CalData | null | undefined>(undefined);
  useEffect(() => {
    fetch(`${HELPER_URL}/calibration-data`)
      .then((r) => r.json())
      .then((d: unknown) => {
        // shape guard: an old helper (unknown route) or anything else
        // unexpected renders the no-helper state, never a crash
        const ok = d !== null && typeof d === "object" && Array.isArray((d as CalData).entries) && Array.isArray((d as CalData).outcomes);
        setData(ok ? (d as CalData) : null);
      })
      .catch(() => setData(null));
  }, []);

  if (data === undefined) return null; // loading: no flash

  if (data === null) {
    return (
      <section className="panel calibration">
        <h2>
          Report card <span className="conf">is the advice tracking your games?</span>
        </h2>
        <p className="quiet">
          The helper isn't running. Your prediction log lives only on your machine, so this card can read it only through the local helper.
        </p>
      </section>
    );
  }

  const { samples, games, pendingOutcomes } = joinSamples(data);
  const a = analyzeCalibration(samples);
  const belowFloor = a.n < DISPLAY_FLOOR;

  return (
    <section className="panel calibration">
      <h2>
        Report card <span className="conf">is the advice tracking your games?</span>
      </h2>
      <p className="lead">
        Draft is one input among many. This measures one narrow thing — whether higher-rated drafts win more often across YOUR logged games —
        and can never say why any single game went the way it did.
      </p>
      <p className="counter" data-testid="counter">
        {games} game{games === 1 ? "" : "s"} logged · {a.n} with outcomes ({a.wins}W/{a.losses}L)
        {pendingOutcomes > 0 ? ` · ${pendingOutcomes} pending` : ""}
      </p>
      {belowFloor ? (
        <>
          <p className="verdict">Sample too small to conclude — the tool refuses to guess.</p>
          <RangeBar a={null} />
          <p className="quiet">
            The shaded range narrows as games accumulate; conclusions become possible only when it stops covering the center line. No single
            game count makes the data "enough" — the range is the whole answer.
          </p>
        </>
      ) : a.insufficient ? (
        <>
          <p className="verdict">Sample too small to conclude — every recorded outcome is the same so far, so ordering can't be measured.</p>
          <RangeBar a={null} />
        </>
      ) : (
        <>
          <p className="verdict">
            {a.ci![0] > 0.5
              ? "Higher-rated drafts have won more often — distinguishable from chance in this sample."
              : a.ci![1] < 0.5
                ? "The ordering signal points the wrong way in this sample — worth attention, not panic."
                : "Inconclusive — the plausible range still includes “no signal at all.”"}
          </p>
          <p>
            Ordering score {a.auc!.toFixed(2)}, plausible range {a.ci![0].toFixed(2)}–{a.ci![1].toFixed(2)} (0.50 = no signal), over {a.pairs}{" "}
            win/loss pairs.
          </p>
          <RangeBar a={a} />
        </>
      )}
    </section>
  );
}
