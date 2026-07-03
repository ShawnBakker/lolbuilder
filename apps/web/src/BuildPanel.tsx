/**
 * F7 build panel (M6b): the champion's highest-win build from the shard,
 * plus the AC-20 rule layer evaluated against the enemy composition.
 * Matchup-conditioned builds are a v2 LCU feature (spec §1 amendment).
 */
import { useSyncExternalStore } from "react";
import type { BuildSet, BuildSlotOption, ChampionRef, DraftState, Shard } from "@lolbuilder/types";
import { MIN_PROFILES, evaluateItemRules, type EnemyProfile, type ItemRule } from "@lolbuilder/core";
import rulesJson from "./item-rules.json";
import { getItem, getItemsVersion, subscribeItems } from "./items.js";
import { getLoaded } from "./data.js";

const RULES = rulesJson.rules as ItemRule[];
const FLAGS = rulesJson.championFlags as Record<string, { heals?: boolean; shields?: boolean; ccHeavy?: boolean }>;

function Item({ id }: { id: number }) {
  const meta = getItem(id);
  if (!meta) return <span className="item unknown">#{id}</span>;
  return (
    <span className="item" title={meta.name}>
      <img src={meta.icon} alt={meta.name} width={28} height={28} loading="lazy" />
    </span>
  );
}

function SetRow({ label, set }: { label: string; set: BuildSet }) {
  return (
    <div className="setrow">
      <span className="lbl">{label}</span>
      {set.set.map((id, i) => (
        <Item key={i} id={id} />
      ))}
      <span className="stat">
        {Math.round(set.wr)}% · {set.n.toLocaleString()} games
      </span>
    </div>
  );
}

function OptionsRow({ label, options }: { label: string; options: BuildSlotOption[] }) {
  return (
    <div className="setrow">
      <span className="lbl">{label}</span>
      {options.slice(0, 3).map((o) => (
        <span key={o.id} className="opt">
          <Item id={o.id} />
          <span className="stat">
            {Math.round(o.wr)}% ({o.n.toLocaleString()})
          </span>
        </span>
      ))}
    </div>
  );
}

export function BuildPanel({ shard, draft, byCid }: { shard: Shard; draft: DraftState; byCid: Map<number, ChampionRef> }) {
  useSyncExternalStore(subscribeItems, getItemsVersion);
  if (!shard.builds) return null;
  const { win } = shard.builds;

  const profiles: EnemyProfile[] = draft.enemies.flatMap((e) => {
    const s = getLoaded(e.cid);
    const dmg = s?.baseline.damage;
    if (!dmg) return []; // enemy shard not loaded yet — rules wait for data
    return [{ cid: e.cid, name: byCid.get(e.cid)?.name ?? String(e.cid), physical: dmg.physical, magic: dmg.magic, ...FLAGS[String(e.cid)] }];
  });
  const recs = evaluateItemRules(profiles, RULES);

  return (
    <section className="panel">
      <h2>
        Highest-win build <span className="conf">(champion-level, Emerald+ — matchup builds arrive with the v2 LCU helper)</span>
      </h2>
      <SetRow label="start" set={win.start} />
      <SetRow label="core" set={win.core} />
      <OptionsRow label="4th" options={win.options.item4} />
      <OptionsRow label="5th" options={win.options.item5} />
      <OptionsRow label="6th" options={win.options.item6} />

      {recs.length > 0 && (
        <>
          <h3>Against this composition</h3>
          {recs.map((r) => (
            <div key={r.ruleId} className="rec">
              {r.items.filter((id) => getItem(id)).map((id) => (
                <Item key={id} id={id} />
              ))}
              <span>
                {r.explanation} <em className="conf">— {r.evidence}</em>
              </span>
            </div>
          ))}
        </>
      )}
      {profiles.length < MIN_PROFILES && (
        <p className="conf">
          comp rules need at least {MIN_PROFILES} enemies entered with data (currently {profiles.length}) — no team-wide claims from a partial comp
        </p>
      )}
      {profiles.length >= MIN_PROFILES && profiles.length < draft.enemies.length && (
        <p className="conf">comp rules evaluated on {profiles.length}/{draft.enemies.length} entered enemies (shards still loading or pre-M6b data)</p>
      )}
    </section>
  );
}
