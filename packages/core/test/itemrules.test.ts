import { describe, expect, it } from "vitest";
import { evaluateItemRules, type EnemyProfile, type ItemRule } from "../src/index.js";

const RULES: ItemRule[] = [
  { id: "anti-heal", trigger: { kind: "healersAtLeast", count: 2 }, items: [3076], explanation: "Grievous wounds vs sustain." },
  { id: "anti-shield", trigger: { kind: "shieldersAtLeast", count: 2 }, items: [6695], explanation: "Shield-cutting vs shield reliance." },
  { id: "tenacity", trigger: { kind: "ccHeavyAtLeast", count: 2 }, items: [3111], explanation: "Tenacity vs layered CC." },
  { id: "mr", trigger: { kind: "apShareAtLeast", share: 0.55 }, items: [3155], explanation: "Magic resist vs AP skew." },
  { id: "armor", trigger: { kind: "adShareAtLeast", share: 0.65 }, items: [3075], explanation: "Armor vs AD skew." },
];

const enemy = (over: Partial<EnemyProfile>): EnemyProfile => ({
  cid: 1,
  name: "X",
  physical: 10_000,
  magic: 2_000,
  ...over,
});

describe("evaluateItemRules (AC-20)", () => {
  it("counts flagged enemies and names them in the evidence", () => {
    const recs = evaluateItemRules(
      [enemy({ cid: 16, name: "Soraka", heals: true }), enemy({ cid: 350, name: "Yuumi", heals: true }), enemy({})],
      RULES,
    );
    const heal = recs.find((r) => r.ruleId === "anti-heal")!;
    expect(heal.items).toEqual([3076]);
    expect(heal.explanation).toBe("Grievous wounds vs sustain.");
    expect(heal.evidence).toContain("2 on the enemy team");
    expect(heal.evidence).toContain("Soraka");
  });

  it("one healer does not fire a two-healer rule", () => {
    const recs = evaluateItemRules([enemy({ heals: true }), enemy({}), enemy({})], RULES);
    expect(recs.find((r) => r.ruleId === "anti-heal")).toBeUndefined();
  });

  it("damage-share triggers use measured comp totals", () => {
    const apComp = [enemy({ physical: 1_000, magic: 9_000 }), enemy({ physical: 2_000, magic: 8_000 })];
    const recs = evaluateItemRules(apComp, RULES);
    expect(recs.find((r) => r.ruleId === "mr")!.evidence).toMatch(/8[0-9]% of enemy damage is magic/);
    expect(recs.find((r) => r.ruleId === "armor")).toBeUndefined();
    const adRecs = evaluateItemRules([enemy({}), enemy({})], RULES);
    expect(adRecs.find((r) => r.ruleId === "armor")).toBeDefined();
    expect(adRecs.find((r) => r.ruleId === "mr")).toBeUndefined();
  });

  it("empty enemy list recommends nothing", () => {
    expect(evaluateItemRules([], RULES)).toEqual([]);
  });
});
