/**
 * Validator + normalizer for the synergy payload (mega ep=build-team).
 * That payload is plain JSON — no graph resolution — but its AC-9 invariant
 * (team_h columns) lives here so all payload validation is one package.
 * Columns are read from the payload's own header array, never hardcoded
 * positions (CLAUDE.md domain constant).
 */

import { LANES, TEAM_H_COLUMNS, type Lane, type SynergyRow } from "@lolbuilder/types";
import { violate } from "./violation.js";

export function extractSynergy(json: unknown): Partial<Record<Lane, SynergyRow[]>> {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    violate("synergy-shape", "payload is not an object");
  }
  const root = json as Record<string, unknown>;
  const header = root["team_h"];
  if (!Array.isArray(header)) {
    violate("synergy-team-h", "team_h missing or not an array");
  }
  const missing = TEAM_H_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    violate("synergy-columns", `team_h lacks [${missing.join(",")}]; got [${header.join(",")}]`);
  }
  const col = Object.fromEntries(TEAM_H_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<
    (typeof TEAM_H_COLUMNS)[number],
    number
  >;
  const team = root["team"];
  if (team === null || typeof team !== "object" || Array.isArray(team)) {
    violate("synergy-team", "team missing or not an object");
  }
  const out: Partial<Record<Lane, SynergyRow[]>> = {};
  for (const [lane, rows] of Object.entries(team as Record<string, unknown>)) {
    if (!LANES.includes(lane as Lane)) {
      violate("synergy-lane", `unknown role "${lane}" in team`);
    }
    if (!Array.isArray(rows)) {
      violate("synergy-rows", `team.${lane} is not an array`);
    }
    out[lane as Lane] = rows.map((r, i) => {
      if (!Array.isArray(r) || r.length < header.length) {
        violate("synergy-row-shape", `team.${lane}[${i}] shorter than team_h`);
      }
      const row = r as number[];
      const pick = (c: (typeof TEAM_H_COLUMNS)[number]): number => {
        const v = row[col[c]];
        if (typeof v !== "number" || !Number.isFinite(v)) {
          violate("synergy-numeric", `team.${lane}[${i}].${c} is ${typeof v}`);
        }
        return v;
      };
      return { id: pick("id"), wr: pick("wr"), d1: pick("d1"), d2: pick("d2"), pr: pick("pr"), n: pick("n") };
    });
  }
  return out;
}
