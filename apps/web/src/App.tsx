import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { LANES, type ChampionRef, type Lane } from "@lolbuilder/types";
import { K_PHASE, phaseBreakdown, scorePick, selectCells, type PickScore } from "@lolbuilder/core";
import { checkStale, getLoaded, getLoadedVersion, loadManifest, subscribeLoaded, trackLoaded, type Manifest } from "./data.js";
import { DISCLOSURE, describeConfidence, ratingToPct, tierFor } from "./display.js";
import { BuildPanel } from "./BuildPanel.js";
import { loadItems } from "./items.js";
import { CaptureController } from "./calibration.js";
import { LcuProvider, type LcuStatus } from "./lcu-provider.js";
import { ManualProvider, type BoardSlot, type BoardSource } from "./provider.js";
import { SlotRow } from "./SlotRow.js";

// AC-M7-2: provider selection is explicit and user-visible (the mode
// toggle). Both sources exist once, at module level; LcuProvider wraps the
// manual one so degraded LCU mode IS the manual board (AC-M7-9).
const manualProvider = new ManualProvider();
const lcuProvider = new LcuProvider(manualProvider);

function useBoard(source: BoardSource): number {
  const sub = useMemo(() => (cb: () => void) => source.subscribe(cb), [source]);
  const snap = useMemo(() => () => source.version(), [source]);
  return useSyncExternalStore(sub, snap);
}

/** AC-M7-10: every connection state has a plain-language line. */
function statusLine(s: LcuStatus): string {
  switch (s.kind) {
    case "connecting":
      return "connecting to helper…";
    case "no-helper":
      return "helper not running — manual entry active";
    case "helper-no-client":
      return "helper up, League client not detected — manual entry active";
    case "not-in-champ-select":
      return "connected — waiting for champ select (manual entry active)";
    case "version-mismatch":
      return `helper is outdated (protocol v${s.helperProtocol}, app expects v${s.expected}) — update the helper; manual entry active`;
    case "unrecognized-payload":
      return `champ-select data unrecognized (${s.invariant}) — the game client may have changed; manual entry active`;
    case "live":
      return `LIVE — ${s.phase}`;
  }
}

function useLoadedShards(): number {
  return useSyncExternalStore(subscribeLoaded, getLoadedVersion);
}

/** Punctuation/space-blind matching: "khaz", "kha'z", "aurelion sol" all hit. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export default function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  // undefined = check pending; null = check UNVERIFIABLE (warn softly — a
  // stale dataset during a DDragon outage must not look confirmed-fresh);
  // object = verified (banner only if actually stale). AC-18, conscious call.
  const [staleInfo, setStaleInfo] = useState<{ stale: boolean; livePatch: string } | null | undefined>(undefined);
  const [selected, setSelected] = useState<{ side: BoardSlot["side"]; index: number }>({ side: "ally", index: 0 });
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [mode, setMode] = useState<"manual" | "lcu">("manual");
  const provider: BoardSource = mode === "lcu" ? lcuProvider : manualProvider;
  const boardVersion = useBoard(provider);
  useLoadedShards();

  useEffect(() => {
    if (mode !== "lcu") return;
    lcuProvider.start();
    // Calibration capture (C.0): rides the provider's notifications;
    // fire-and-forget by construction — can never affect the board.
    const capture = new CaptureController(getLoaded);
    const unsub = lcuProvider.subscribe(() => capture.onUpdate(lcuProvider));
    return () => {
      unsub();
      lcuProvider.stop();
    };
  }, [mode]);

  useEffect(() => {
    void loadManifest().then(async (m) => {
      setManifest(m);
      loadItems(m.ddragon);
      setStaleInfo(await checkStale(m.patch));
    });
  }, []);

  // AC-2: every champion on the board is prefetched the moment it appears
  // (assign() fires trackLoaded directly; this covers any other path).
  const draft = provider.getDraftState();
  useEffect(() => {
    for (const slot of provider.slots()) {
      if (slot.cid !== null) trackLoaded(slot.cid);
    }
  }, [boardVersion]);

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
    if (!manifest || !norm(query)) return [];
    const q = norm(query);
    const all = manifest.champions.filter((c) => norm(c.name).includes(q) || c.slug.includes(q));
    // prefix matches first, so "ka" ranks Kayle/Kassadin above Akali
    all.sort((a, b) => Number(norm(b.name).startsWith(q)) - Number(norm(a.name).startsWith(q)) || a.name.localeCompare(b.name));
    return all.slice(0, 8);
  }, [manifest, query]);

  useEffect(() => setHighlight(0), [query]);

  const assign = (c: ChampionRef) => {
    provider.assign(selected.side, selected.index, c.cid);
    trackLoaded(c.cid);
    setQuery("");
    // auto-advance to the next empty slot: entering a full lobby is one
    // continuous type-Enter flow, not ten click-type round-trips
    const next = provider.nextEmpty();
    if (next) setSelected(next);
  };

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      assign(results[Math.min(highlight, results.length - 1)]!);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  };

  if (!manifest) return <main className="wrap">loading dataset…</main>;

  return (
    <main className="wrap">
      <h1>lolbuilder</h1>
      <p className="sub">
        advisory draft analysis · patch {manifest.patch} · dataset {new Date(manifest.generatedAt).toISOString().slice(0, 10)} · Emerald+ ranked, all regions
      </p>
      {staleInfo?.stale && (
        <div className="banner">
          Dataset is patch {manifest.patch} but live is {staleInfo.livePatch} — numbers below are stale until the pipeline catches up.
        </div>
      )}
      {staleInfo === null && (
        <div className="banner soft">
          Couldn't verify dataset freshness (version check unreachable) — patch {manifest.patch} data may or may not be current.
        </div>
      )}

      <div className="mode">
        <button className={mode === "manual" ? "on" : ""} onClick={() => setMode("manual")}>
          Manual
        </button>
        <button className={mode === "lcu" ? "on" : ""} onClick={() => setMode("lcu")}>
          Auto (LCU helper)
        </button>
        {mode === "lcu" && (
          <span className={`lcu-status ${lcuProvider.status().kind === "live" ? "live" : ""}`} data-v={boardVersion}>
            {statusLine(lcuProvider.status())}
          </span>
        )}
      </div>

      <section className="boards">
        {(["ally", "enemy"] as const).map((side) => (
          <div key={side} className="board">
            <h2>{side === "ally" ? "Your team" : "Enemy team"}</h2>
            {provider
              .slots()
              .filter((s) => s.side === side)
              .map((slot) => (
                <SlotRow
                  key={slot.index}
                  slot={slot}
                  champName={slot.cid !== null ? (byCid.get(slot.cid)?.name ?? String(slot.cid)) : null}
                  isPick={side === "ally" && slot.index === 0}
                  isSelected={selected.side === side && selected.index === slot.index}
                  onSelect={() => setSelected({ side, index: slot.index })}
                  onSetLane={(lane) => provider.setLane(side, slot.index, lane)}
                  onClear={() => provider.assign(side, slot.index, null)}
                />
              ))}
          </div>
        ))}
      </section>

      <section className="search">
        {/* autoComplete/spellCheck off: the browser's own suggestion dropdown
            over this input swallows ArrowUp/ArrowDown before the page sees
            them (Bug 1 root cause hypothesis — handler verified working
            against real DOM keydown events; the native autofill layer is the
            one thing headless tests cannot reproduce). */}
        <input
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={results.length > 0}
          aria-autocomplete="list"
          placeholder={`assign to: ${selected.side} ${selected.side === "ally" && selected.index === 0 ? "pick slot" : "slot " + (selected.index + 1)} — type, ↑↓ to choose, Enter to assign`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKey}
        />
        <div className="results">
          {results.map((c, i) => (
            <button key={c.cid} className={i === highlight ? "hl" : ""} onMouseEnter={() => setHighlight(i)} onClick={() => assign(c)}>
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

      {pickShard && draft && <BuildPanel shard={pickShard} draft={draft} byCid={byCid} />}

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
