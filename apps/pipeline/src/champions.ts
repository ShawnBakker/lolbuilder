/**
 * Champion roster from Data Dragon's manifest (AC-6): a new champion release
 * requires zero code changes. Slug = DDragon key lowercased; divergences from
 * lolalytics' URL slugs are handled by an explicit override map that is only
 * ever populated from observed run failures — never guessed.
 */
import { ddragonToLolalytics, type ChampionRef } from "@lolbuilder/types";
import type { PoliteFetcher } from "./fetcher.js";

export type { ChampionRef };

export interface Roster {
  ddragon: string;
  patch: string;
  champions: ChampionRef[];
}

/** DDragon-key → lolalytics-slug overrides, evidence-only (see module doc). */
const SLUG_OVERRIDES: Record<string, string> = {
  // 2026-07-03 full run: monkeyking → HTTP 404; wukong → 200 with cid 62
  // hand-verified against DDragon's MonkeyKing key (62).
  MonkeyKing: "wukong",
};

export async function fetchRoster(fetcher: PoliteFetcher): Promise<Roster> {
  const versions = (await fetcher.json("https://ddragon.leagueoflegends.com/api/versions.json")) as string[];
  const ddragon = versions[0];
  if (!ddragon) throw new Error("empty DDragon version manifest");
  const patch = ddragonToLolalytics(ddragon);

  const manifest = (await fetcher.json(
    `https://ddragon.leagueoflegends.com/cdn/${ddragon}/data/en_US/champion.json`,
  )) as { data: Record<string, { key: string; id: string; name: string }> };

  const champions = Object.values(manifest.data)
    .map((c) => ({
      cid: Number(c.key),
      slug: SLUG_OVERRIDES[c.id] ?? c.id.toLowerCase(),
      name: c.name,
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  if (champions.length < 100 || champions.some((c) => !Number.isInteger(c.cid))) {
    throw new Error(`implausible roster: ${champions.length} champions`);
  }
  return { ddragon, patch, champions };
}
