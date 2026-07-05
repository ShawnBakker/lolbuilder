/**
 * Domain types transcribed from the validated data contracts
 * (docs/brainstorm/smoke-findings.md + addendum; spec §2).
 * Types only — feature logic lives in later milestones.
 */

export * from "./patch.js";

/**
 * Helper↔frontend protocol version (AC-M7-14). Shared constant so the two
 * sides cannot drift silently: the helper reports it on every response and
 * the frontend refuses (visibly, with an explanation) on mismatch. Bump on
 * any breaking change to the helper's HTTP surface.
 * (The /calibration-log POST added in C.0 is additive: old helpers simply
 * lack the route and fire-and-forget capture fails harmlessly — protocol
 * stays 1.)
 */
export const HELPER_PROTOCOL = 1;

/**
 * The helper's current version — SHARED so the frontend can run the
 * check-and-prompt update tier (expansion-decisions): frontend and helper
 * build from the same commit, so this constant IS the latest release from
 * the frontend's point of view, and a helper reporting anything older gets
 * a visible "update available" prompt. No auto-update, no new outbound
 * surface — the human re-downloads helper.zip.
 */
export const HELPER_VERSION = "0.2.0";

/** Calibration log entry schema version (append-forever data — spec C.0). */
export const CALIBRATION_SCHEMA = 1;

/** Matchmade queues eligible for the calibration sample (AC-C-3). */
export const MATCHMADE_QUEUES = [400, 420, 440] as const;

/**
 * One calibration log entry (spec AC-C-1, OI-C-3 confirmed). The frontend
 * constructs and POSTs it; the helper validates, enriches with `platform`
 * (+ receivedAt), and appends to the local JSONL log. Both at-pick and
 * finalization phases produce one entry each per game.
 */
export interface CalibrationEntryV1 {
  schema: typeof CALIBRATION_SCHEMA;
  gameId: number;
  queueId: number;
  phase: "at-pick" | "finalization";
  /** The engine rating (logit units) at the capture moment. */
  rating: number;
  /** The DraftState that was scored (role-known enemies only). */
  draft: DraftState;
  /** Information level at capture — lets at-pick stratify later (OI-C-3). */
  enemiesVisible: number;
  alliesVisible: number;
  lockedAt: string;
  /**
   * The configuration that produced the rating. Ratings are k-dependent
   * (D8: k is tunable) and dataset-dependent (patch) — entries logged
   * under different configs are NOT poolable without stratification, so
   * every entry must carry its own provenance or the first k-tune forks
   * the dataset silently.
   */
  context: {
    patch: string;
    kMatchup: number;
    kSynergy: number;
  };
}

/** Numeric champion id — how lolalytics *responses* key champions. */
export type ChampionId = number;

/**
 * Lowercase internal champion key — how lolalytics *requests* key champions
 * (`c=aatrox`). Diverges from display names (Wukong = "MonkeyKing");
 * Data Dragon is the id ↔ key ↔ display-name bridge.
 */
export type ChampionSlug = string;

export const LANES = ["top", "jungle", "middle", "bottom", "support"] as const;
export type Lane = (typeof LANES)[number];

/** Known-good tier filters; the endpoint accepts more (source-defined). */
export type Tier = "all" | "emerald_plus" | (string & {});

/**
 * Column header contract of the synergy payload. Parse the payload's own
 * `team_h` array and match against this set — never hardcode column positions.
 */
export const TEAM_H_COLUMNS = ["id", "wr", "d1", "d2", "pr", "n"] as const;
export type TeamHColumn = (typeof TEAM_H_COLUMNS)[number];

/** One normalized synergy cell (mega ep=build-team, per teammate role). */
export interface SynergyRow {
  id: ChampionId;
  /** Duo win rate, percent. */
  wr: number;
  /** Precomputed normalized deltas — OPAQUE until OI-3 verifies their semantics. */
  d1: number;
  d2: number;
  /** Pick rate, percent. */
  pr: number;
  /** Games together. n=1 rows exist in live data — shrinkage is mandatory. */
  n: number;
}

/** Raw synergy payload shape (rows are number-arrays ordered by team_h). */
export interface RawSynergyPayload {
  team_h: readonly string[];
  team: Partial<Record<Lane, ReadonlyArray<ReadonlyArray<number>>>>;
  response: { valid: boolean; duration: string };
}

/** One normalized matchup cell (counters q-data, post-resolution). */
export interface MatchupRow {
  cid: ChampionId;
  /** Matchup win rate vs this opponent, percent. */
  vsWr: number;
  /** Games; source-floored at n≥100 (min observed 101). */
  n: number;
  /** Precomputed deltas — OPAQUE until OI-3 (percentage-point scale per site docs). */
  d1: number;
  d2: number;
  /** Opponent's overall win rate (avg-opponent baseline). */
  allWr: number;
  defaultLane: Lane;
}

/** Average per-game damage by type (from the build payload). Drives the
 * AP/AD-skew itemization rules — measured, not inferred from tags. */
export interface DamageProfile {
  physical: number;
  magic: number;
  true: number;
}

/** Champion baseline stats from the build-route payload (default lane). */
export interface BaselineStats {
  cid: ChampionId;
  /** Lane the payload describes — v1 fetches the champion's default lane. */
  lane: Lane;
  defaultLane: Lane;
  /** lolalytics patch the stats belong to (e.g. "16.13"). */
  patch: string;
  /** Win rate %, average opponent WR %, pick rate %, ban rate %, games. */
  wr: number;
  avgWr: number;
  pr: number;
  br: number;
  n: number;
  /** Optional: pre-M6b shards lack it. */
  damage?: DamageProfile;
}

export const BUCKET_INDICES = ["1", "2", "3", "4", "5", "6", "7"] as const;
export type BucketIndex = (typeof BUCKET_INDICES)[number];

/**
 * 7 game-length buckets. In raw q-data these are objects keyed "1"–"7"
 * (NOT arrays) whose leaves may arrive literal or base-36-ref-interned —
 * this type describes the post-resolution shape.
 * Bucket→minutes mapping is UNRESOLVED (OI-1): no minute labels anywhere.
 * Semantics: WR conditional on the game ENDING in the bucket (selection
 * effect — see AC-16b/AC-19), not "strength during the phase".
 */
export type TimeBuckets = Record<BucketIndex, number>;

export interface GameLengthData {
  /** Games per bucket. */
  time: TimeBuckets;
  /** Wins per bucket; invariant: wins ≤ games, per bucket. */
  timeWin: TimeBuckets;
}

/** One item option for a build slot, with its sample. */
export interface BuildSlotOption {
  id: number;
  wr: number;
  n: number;
}

/** An ordered item set (start pair, core triple) with its sample. */
export interface BuildSet {
  set: number[];
  wr: number;
  n: number;
}

/** One build recommendation column (the site's "highest win" or "most picked"). */
export interface BuildVariant {
  start: BuildSet;
  core: BuildSet;
  options: {
    item4: BuildSlotOption[];
    item5: BuildSlotOption[];
    item6: BuildSlotOption[];
  };
}

/** Champion-level builds. Matchup-conditioned (vs-route) builds are validated
 * to exist but are architecturally undeliverable in v1 (no CORS, no pre-scrape
 * at pair scale, no server) — v2's local LCU helper is the delivery path. */
export interface ChampionBuilds {
  win: BuildVariant;
  pick: BuildVariant;
}

/** One champion in the pipeline's roster manifest. */
export interface ChampionRef {
  cid: ChampionId;
  slug: ChampionSlug;
  name: string;
}

/**
 * Published per-champion shard — the contract between the pipeline (writer)
 * and the scoring engine / frontend (readers). Matches what M2 emits.
 */
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
  /** Champion-level item builds (M6a). Optional: pre-M6a shards lack it. */
  builds?: ChampionBuilds;
  /**
   * Per-lane pick share % (M7.0, from the counters payload's lanes field).
   * The champion-role prior that M7.3's enemy-role inference leans on —
   * load-bearing, per PC-M7-3 (the LCU exposes no enemy positions).
   * Optional: pre-M7.0 shards lack it.
   */
  lanes?: Record<Lane, number>;
}

/** A champion assigned to a lane on the draft board. */
export interface SlotRef {
  cid: ChampionId;
  lane: Lane;
}

/**
 * The 10-champion draft state produced by a DraftStateProvider (spec F1).
 * `pick` is the slot being assessed; allies exclude it (≤4); enemies ≤5.
 */
export interface DraftState {
  pick: SlotRef;
  allies: SlotRef[];
  enemies: SlotRef[];
}
