/**
 * Per-champion scrape → shard (plan M2). Failure policy per CLAUDE.md:
 * QDataFormatViolation = schema-change alarm → rethrown, aborts the run.
 * FetchFailure (HTTP) = per-champion problem (e.g. slug divergence) →
 * collected, run continues, reported in the manifest.
 *
 * Gap B: every shard carries all five vslane matchup tables so flex/off-role
 * scoring has real cross-lane cells (spec AC-3 data dependency).
 */
import { LANES, type BaselineStats, type GameLengthData, type Lane, type MatchupRow, type SynergyRow } from "@lolbuilder/types";
import { extractBaseline, extractGameLength, extractMatchups, extractSynergy, parsePayload } from "@lolbuilder/qdata";
import type { ChampionRef } from "./champions.js";
import { buildUrl, countersUrl, synergyUrl } from "./config.js";
import type { PoliteFetcher } from "./fetcher.js";

export interface Shard {
  champ: ChampionRef;
  patch: string;
  baseline: BaselineStats;
  gameLength: GameLengthData;
  /** Default counters table (all opponent lanes aggregated). */
  matchups: MatchupRow[];
  /** Per-opponent-lane matchup tables (vslane variants) — AC-3's data. */
  matchupsVsLane: Record<Lane, MatchupRow[]>;
  synergy: Partial<Record<Lane, SynergyRow[]>>;
}

export async function scrapeChampion(fetcher: PoliteFetcher, champ: ChampionRef, patch: string): Promise<Shard> {
  const build = parsePayload(await fetcher.json(buildUrl(champ.slug)));
  const baseline = extractBaseline(build);
  if (baseline.cid !== champ.cid) {
    // Slug resolved to a different champion than the manifest says — a silent
    // wrong-data hazard, treated as loudly as a format violation.
    throw new Error(`cid mismatch for slug "${champ.slug}": manifest ${champ.cid}, payload ${baseline.cid}`);
  }
  const gameLength = extractGameLength(build);

  const matchups = extractMatchups(parsePayload(await fetcher.json(countersUrl(champ.slug))));
  const matchupsVsLane = {} as Record<Lane, MatchupRow[]>;
  for (const lane of LANES) {
    matchupsVsLane[lane] = extractMatchups(parsePayload(await fetcher.json(countersUrl(champ.slug, lane))));
  }

  const synergy = extractSynergy(await fetcher.json(synergyUrl(champ.slug, patch)));

  return { champ, patch, baseline, gameLength, matchups, matchupsVsLane, synergy };
}
