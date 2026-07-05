/**
 * Platform sourcing (spec AC-C-1, Pass A Gap 1): the champ-select session
 * does NOT carry a platform/region key (dump-verified), so the Match-V5
 * platform id ("NA1") is resolved separately:
 *   1. LEAGUE_PLATFORM env override wins (config path, AC-M7-5 style)
 *   2. else one LCU GET to /riotclient/region-locale → region → platform
 *   3. else null — FAIL-SOFT: entries still log with platform:null and the
 *      outcome-fetch (C.1) skips them LOUDLY until a platform is known.
 *      Silently defaulting to NA1 would be a silent-wrong for non-NA
 *      players — blank beats wrong here too.
 * Endpoint shape is verified live at C.0's DoD run (client was down at
 * build time); the resolver validates the shape and fails soft on surprise.
 */
import { logError } from "./sanitize.js";

const REGION_TO_PLATFORM: Record<string, string> = {
  NA: "NA1",
  BR: "BR1",
  LAN: "LA1",
  LAS: "LA2",
  EUW: "EUW1",
  EUNE: "EUN1",
  TR: "TR1",
  RU: "RU",
  KR: "KR",
  JP: "JP1",
  OCE: "OC1",
  OC1: "OC1",
  PH: "PH2",
  SG: "SG2",
  TH: "TH2",
  TW: "TW2",
  VN: "VN2",
  ME: "ME1",
};

let cached: string | null | undefined; // undefined = not yet resolved

export function resetPlatformCache(): void {
  cached = undefined;
}

export async function resolvePlatform(
  lcuGet: (path: string) => Promise<{ status: number; body: string }> | null,
): Promise<string | null> {
  if (cached !== undefined) return cached;
  const override = process.env["LEAGUE_PLATFORM"];
  if (override) {
    cached = override.toUpperCase();
    return cached;
  }
  try {
    const probe = lcuGet("/riotclient/region-locale");
    if (!probe) return null; // no client yet: NOT cached — retry next entry
    const res = await probe;
    if (res.status !== 200) return null;
    const parsed = JSON.parse(res.body) as { region?: unknown };
    const region = typeof parsed.region === "string" ? parsed.region.toUpperCase() : null;
    const platform = region ? (REGION_TO_PLATFORM[region] ?? null) : null;
    if (!platform) {
      logError(`platform resolution: region-locale returned unrecognized region "${String(region)}" — logging entries with platform:null (set LEAGUE_PLATFORM to fix)`);
    }
    cached = platform;
    return cached;
  } catch (err) {
    logError("platform resolution failed (entries log with platform:null; set LEAGUE_PLATFORM to fix):", err);
    return null;
  }
}
