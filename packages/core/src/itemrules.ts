/**
 * Team-aware itemization rule layer (spec F7 / AC-20). Rules are DATA —
 * this module only evaluates them; the rule definitions (triggers, item
 * lists, explanation strings) live in JSON owned by the UI layer, and every
 * recommendation carries its rule's explanation plus the computed evidence
 * that fired it. Pure: comp profile in, recommendations out.
 */

export interface EnemyProfile {
  cid: number;
  name: string;
  /** Average per-game physical/magic damage (from shard baselines). */
  physical: number;
  magic: number;
  /** Curated flags (small table in rules JSON, evidence: well-known kits). */
  heals?: boolean;
  shields?: boolean;
  ccHeavy?: boolean;
}

export type RuleTrigger =
  | { kind: "healersAtLeast"; count: number }
  | { kind: "shieldersAtLeast"; count: number }
  | { kind: "ccHeavyAtLeast"; count: number }
  | { kind: "apShareAtLeast"; share: number }
  | { kind: "adShareAtLeast"; share: number };

export interface ItemRule {
  id: string;
  trigger: RuleTrigger;
  /** Item ids to surface; UI resolves names/icons and drops unknown ids. */
  items: number[];
  explanation: string;
}

export interface ItemRecommendation {
  ruleId: string;
  items: number[];
  explanation: string;
  /** The computed fact that fired the trigger, for the UI to show. */
  evidence: string;
}

const names = (list: EnemyProfile[]) => list.map((e) => e.name).join(", ");

/**
 * Partial-data gate (operator finding, 2026-07-03): a team-wide claim from a
 * one-champion sample is false precision wearing an honest label. Below
 * MIN_PROFILES enemies, NO rule evaluates — same silence-when-unwarranted
 * pattern as missing scoring cells. At 3–4 of TEAM_SIZE, every evidence
 * string names its basis so it cannot read as a full-team conclusion.
 * Uniform across all rules: the count rules share the flaw (2 flagged of 2
 * entered implies a 5-man statement), not just the damage-share rules.
 */
export const MIN_PROFILES = 3;
export const TEAM_SIZE = 5;

export function evaluateItemRules(enemies: EnemyProfile[], rules: ItemRule[]): ItemRecommendation[] {
  if (enemies.length < MIN_PROFILES) return [];
  const basis = enemies.length < TEAM_SIZE ? ` — based on ${enemies.length} of ${TEAM_SIZE} enemies entered` : "";
  const totalPhys = enemies.reduce((a, e) => a + e.physical, 0);
  const totalMagic = enemies.reduce((a, e) => a + e.magic, 0);
  const apShare = totalPhys + totalMagic > 0 ? totalMagic / (totalPhys + totalMagic) : 0.5;

  const out: ItemRecommendation[] = [];
  for (const rule of rules) {
    const t = rule.trigger;
    let fired = false;
    let evidence = "";
    if (t.kind === "healersAtLeast" || t.kind === "shieldersAtLeast" || t.kind === "ccHeavyAtLeast") {
      const flag = t.kind === "healersAtLeast" ? "heals" : t.kind === "shieldersAtLeast" ? "shields" : "ccHeavy";
      const hits = enemies.filter((e) => e[flag as "heals" | "shields" | "ccHeavy"]);
      fired = hits.length >= t.count;
      evidence = `${hits.length} on the enemy team${hits.length ? ` (${names(hits)})` : ""}`;
    } else if (t.kind === "apShareAtLeast") {
      fired = apShare >= t.share;
      evidence = `${Math.round(apShare * 100)}% of enemy damage is magic`;
    } else {
      fired = 1 - apShare >= t.share;
      evidence = `${Math.round((1 - apShare) * 100)}% of enemy damage is physical`;
    }
    if (fired) out.push({ ruleId: rule.id, items: rule.items, explanation: rule.explanation, evidence: evidence + basis });
  }
  return out;
}
