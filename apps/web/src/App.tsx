import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { LANES, type ChampionRef, type Lane } from "@lolbuilder/types";
import { K_PHASE, phaseBreakdown, scorePick, selectCells, type PickScore } from "@lolbuilder/core";
import { checkStale, getLoaded, loadManifest, trackLoaded, type Manifest } from "./data.js";
import { DISCLOSURE, describeConfidence, ratingToPct, tierFor } from "./display.js";
import { ManualProvider, type BoardSlot } from "./provider.js";

const provider = new ManualProvider();

function useBoard(): number {
  return useSyncExternalStore(
    (cb) => provider.subscribe(cb),
    (() => {
      let version = 0;
      let last = "";
      return () => {
        const now = JSON.stringify(provider.slots());
        if (now !== last) {
          last = now;
          version++;
        }
        return version;
      };
    })(),
  );
}

export default function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [staleInfo, setStaleInfo] = useState<{ stale: boolean; livePatch: string } | null>(null);
  const [selected, setSelected] = useState<{ side: BoardSlot["side"]; index: number }>({ side: "ally", index: 0 });
  const [query, setQuery] = useState("");
  const [dataVersion, setDataVersion] = useState(0);
  useBoard();

  useEffect(() => {
    void loadManifest().then(async (m) => {
      setManifest(m);
      setStaleInfo(await checkStale(m.patch));
    });
  }, []);

  // AC-2: every champion on the board is prefetched the moment it appears.
  const draft = provider.getDraftState();
  useEffect(() => {
    for (const slot of provider.slots()) {
      if (slot.cid !== null) trackLoaded(slot.cid);
    }
    const t = setInterval(() => setDataVersion((v) => v + 1), 300); // pick up shard arrivals
    return () => clearInterval(t);
  });

  const byCid = useMemo(() => new Map((manifest?.champions ?? []).map((c) => [c.cid, c])), [manifest]);
  const pickShard = draft ? getLoaded(draft.pick.cid) : null;

  let score: PickScore | null = null;
  let scoreError: string | null = null;
  if (draft && pickShard) {
    try {
      score = scorePick(selectCells(draft, pickShard));
    } catch (e) {
      scoreError = String(e);
    }
  }

  const results = useMemo(() => {
    if (!manifest || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    return manifest.champions.filter((c) => c.name.toLowerCase().includes(q) || c.slug.includes(q)).slice(0, 8);
  }, [manifest, query]);

  const assign = (c: ChampionRef) => {
    provider.assign(selected.side, selected.index, c.cid);
    trackLoaded(c.cid);
    setQuery("");
  };

  if (!manifest) return <main className="wrap">loading dataset…</main>;

  return (
    <main className="wrap" data-v={dataVersion}>
      <h1>lolbuilder</h1>
      <p className="sub">
        advisory draft analysis · patch {manifest.patch} · dataset {new Date(manifest.generatedAt).toISOString().slice(0, 10)} · Emerald+ ranked, all regions
      </p>
      {staleInfo?.stale && (
        <div className="banner">
          Dataset is patch {manifest.patch} but live is {staleInfo.livePatch} — numbers below are stale until the pipeline catches up.
        </div>
      )}

      <section className="boards">
        {(["ally", "enemy"] as const).map((side) => (
          <div key={side} className="board">
            <h2>{side === "ally" ? "Your team" : "Enemy team"}</h2>
            {provider
              .slots()
              .filter((s) => s.side === side)
              .map((slot) => {
                const champ = slot.cid !== null ? byCid.get(slot.cid) : null;
                const isSel = selected.side === side && selected.index === slot.index;
                const isPick = side === "ally" && slot.index === 0;
                return (
                  <div key={slot.index} className={`slot ${isSel ? "sel" : ""}`} onClick={() => setSelected({ side, index: slot.index })}>
                    <select
                      value={slot.lane}
                      onChange={(e) => provider.setLane(side, slot.index, e.target.value as Lane)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {LANES.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <span className="who">
                      {isPick ? "★ " : ""}
                      {champ ? champ.name : <em>empty{isPick ? " — your pick" : ""}</em>}
                    </span>
                    {champ && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          provider.assign(side, slot.index, null);
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </section>

      <section className="search">
        <input
          placeholder={`assign to: ${selected.side} ${selected.side === "ally" && selected.index === 0 ? "pick slot" : "slot " + (selected.index + 1)} — type a champion…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="results">
          {results.map((c) => (
            <button key={c.cid} onClick={() => assign(c)}>
              {c.name}
            </button>
          ))}
        </div>
      </section>

      {draft && !pickShard && <p>loading shard for your pick…</p>}
      {scoreError && <div className="banner">scoring failed: {scoreError}</div>}

      {score && pickShard && draft && (
        <section className="panel">
          <h2>
            {tierFor(ratingToPct(score.rating))} · ≈{ratingToPct(score.rating)}%
            <span className="conf"> ({describeConfidence(score)})</span>
          </h2>
          <table>
            <thead>
              <tr>
                <th>signal</th>
                <th>vs/with</th>
                <th>logit Δ</th>
                <th>games</th>
              </tr>
            </thead>
            <tbody>
              {score.components.map((c, i) => (
                <tr key={i}>
                  <td>{c.kind}</td>
                  <td>{c.cid ? (byCid.get(c.cid)?.name ?? c.cid) : "—"}</td>
                  <td>{c.delta >= 0 ? "+" : ""}{c.delta.toFixed(2)}</td>
                  <td>{c.n.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {score.missing.length > 0 && (
            <p className="missing">
              no data: {score.missing.map((m) => `${m.kind} ${byCid.get(m.cid)?.name ?? m.cid}`).join(", ")} — these contribute nothing rather than a guess.
            </p>
          )}

          <h3>By game length (relative phases — see disclosure)</h3>
          <table>
            <tbody>
              {Object.entries(phaseBreakdown(pickShard.gameLength, pickShard.baseline.wr, K_PHASE)).map(([phase, r]) => (
                <tr key={phase}>
                  <td>{phase}</td>
                  <td>{r.wr === "insufficient" ? "insufficient data" : `${Math.round(r.wr)}%`}</td>
                  <td>{r.games.toLocaleString()} games</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <footer>
        <h3>What this can't tell you</h3>
        <ul>
          {DISCLOSURE.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </footer>
    </main>
  );
}
