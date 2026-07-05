/**
 * Riot Match-V5 client (C.1) — the helper's SECOND outbound surface,
 * explicitly rescoped in the invariants test: GET-only, Riot's official
 * regional API hosts only, key from the environment only. This is a READ
 * of the sanctioned API; the read-only hard line (no WRITES to any Riot
 * surface) is untouched.
 *
 * PC-C-2 gate, verified not trusted: the key that once transited a chat
 * is refused by SHA-256 fingerprint — reconcile will not run against it.
 * The fingerprint is a hash; the key itself never appears in the repo.
 */
import { createHash } from "node:crypto";
import { logError } from "./sanitize.js";

/** SHA-256 of the chat-transited key (PC-C-2). Never the key itself. */
const COMPROMISED_KEY_SHA256 = "ffb9b9745248fbab8b67c1d32e3aff63de42063fcf389aa90b1d2083edaab729";

const PLATFORM_TO_REGION: Record<string, string> = {
  NA1: "americas", BR1: "americas", LA1: "americas", LA2: "americas",
  EUW1: "europe", EUN1: "europe", TR1: "europe", RU: "europe", ME1: "europe",
  KR: "asia", JP1: "asia",
  OC1: "sea", SG2: "sea", PH2: "sea", TH2: "sea", TW2: "sea", VN2: "sea",
};

export type KeyState = "absent" | "compromised" | "usable";

export function keyState(): KeyState {
  const key = process.env["RIOT_KEY"];
  if (!key) return "absent";
  if (createHash("sha256").update(key).digest("hex") === COMPROMISED_KEY_SHA256) return "compromised";
  return "usable";
}

export interface RiotResult {
  status: number;
  body: unknown;
}

/** GET one Match-V5 resource. The key goes in a header, never a URL or log. */
export async function riotGet(platform: string, path: string): Promise<RiotResult> {
  const region = PLATFORM_TO_REGION[platform];
  if (!region) {
    logError(`riot: unknown platform "${platform}" — cannot route`);
    return { status: 0, body: null };
  }
  const res = await fetch(`https://${region}.api.riotgames.com${path}`, {
    headers: { "X-Riot-Token": process.env["RIOT_KEY"] ?? "" },
  });
  return { status: res.status, body: res.status === 200 ? await res.json() : null };
}

export const fetchMatch = (platform: string, gameId: number): Promise<RiotResult> =>
  riotGet(platform, `/lol/match/v5/matches/${platform}_${gameId}`);

export const fetchTimeline = (platform: string, gameId: number): Promise<RiotResult> =>
  riotGet(platform, `/lol/match/v5/matches/${platform}_${gameId}/timeline`);
