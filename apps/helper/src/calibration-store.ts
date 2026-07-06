/**
 * The calibration log (spec AC-C-2): local JSONL, append-only, idempotent
 * per (gameId, phase), matchmade-only at the door (AC-C-3). This is the
 * one legitimate local write in the project — the exception AC-M7-12
 * carved. It lives under LOCALAPPDATA (not next to the helper file) so a
 * friend replacing helper.mjs never loses their accumulated games.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CALIBRATION_SCHEMA, MATCHMADE_QUEUES } from "@lolbuilder/types";
import { logError } from "./sanitize.js";

export function defaultLogDir(): string {
  return process.env["LOLBUILDER_LOG_DIR"] ?? join(process.env["LOCALAPPDATA"] ?? homedir(), "lolbuilder");
}

export type StoreResult =
  | { state: "logged" }
  | { state: "duplicate" }
  | { state: "rejected-queue"; queueId: number }
  | { state: "invalid-entry"; invariant: string };

const PHASES = new Set(["at-pick", "finalization"]);

/** Shape-validate an incoming entry (frontend-supplied; helper enriches). */
export function validateEntry(raw: unknown): { ok: true; entry: Record<string, unknown> } | { ok: false; invariant: string } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, invariant: "entry-shape" };
  const e = raw as Record<string, unknown>;
  if (e["schema"] !== CALIBRATION_SCHEMA) return { ok: false, invariant: "entry-schema" };
  if (!Number.isInteger(e["gameId"]) || (e["gameId"] as number) <= 0) return { ok: false, invariant: "entry-gameid" };
  if (!Number.isInteger(e["queueId"])) return { ok: false, invariant: "entry-queueid" };
  if (!PHASES.has(String(e["phase"]))) return { ok: false, invariant: "entry-phase" };
  if (typeof e["rating"] !== "number" || !Number.isFinite(e["rating"])) return { ok: false, invariant: "entry-rating" };
  if (e["draft"] === null || typeof e["draft"] !== "object") return { ok: false, invariant: "entry-draft" };
  if (!Number.isInteger(e["enemiesVisible"]) || !Number.isInteger(e["alliesVisible"])) return { ok: false, invariant: "entry-visibility" };
  if (typeof e["lockedAt"] !== "string") return { ok: false, invariant: "entry-timestamp" };
  const ctx = e["context"] as Record<string, unknown> | null;
  if (ctx === null || typeof ctx !== "object" || typeof ctx["patch"] !== "string" || typeof ctx["kMatchup"] !== "number" || typeof ctx["kSynergy"] !== "number") {
    return { ok: false, invariant: "entry-context" }; // rating provenance is mandatory — a context-less rating is unpoolable
  }
  return { ok: true, entry: e };
}

/** Both local files, parsed — the /calibration-data serving shape (C.3). */
export function readCalibrationData(dir: string = defaultLogDir()): { entries: unknown[]; outcomes: unknown[] } {
  const read = (name: string): unknown[] => {
    const f = join(dir, name);
    if (!existsSync(f)) return [];
    return readFileSync(f, "utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => {
        try {
          return JSON.parse(l) as unknown;
        } catch {
          return null;
        }
      })
      .filter((x) => x !== null);
  };
  return { entries: read("calibration-log.jsonl"), outcomes: read("calibration-outcomes.jsonl") };
}

export class CalibrationStore {
  #dir: string;
  #file: string;
  #keys: Set<string> | null = null; // lazy-loaded (gameId:phase) index

  constructor(dir: string = defaultLogDir()) {
    mkdirSync(dir, { recursive: true });
    this.#dir = dir;
    this.#file = join(dir, "calibration-log.jsonl");
  }

  get dir(): string {
    return this.#dir;
  }

  get file(): string {
    return this.#file;
  }

  #loadKeys(): Set<string> {
    if (this.#keys) return this.#keys;
    this.#keys = new Set();
    if (existsSync(this.#file)) {
      for (const line of readFileSync(this.#file, "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line) as { gameId?: number; phase?: string };
          this.#keys.add(`${e.gameId}:${e.phase}`);
        } catch {
          logError("calibration log contains an unparseable line — skipped for idempotency indexing (file preserved untouched)");
        }
      }
    }
    return this.#keys;
  }

  append(raw: unknown, platform: string | null): StoreResult {
    const v = validateEntry(raw);
    if (!v.ok) return { state: "invalid-entry", invariant: v.invariant };
    const queueId = v.entry["queueId"] as number;
    if (!(MATCHMADE_QUEUES as readonly number[]).includes(queueId)) {
      return { state: "rejected-queue", queueId }; // named, expected, not an error (AC-C-3)
    }
    const key = `${v.entry["gameId"]}:${v.entry["phase"]}`;
    const keys = this.#loadKeys();
    if (keys.has(key)) return { state: "duplicate" };
    appendFileSync(this.#file, JSON.stringify({ ...v.entry, platform, receivedAt: new Date().toISOString() }) + "\n");
    keys.add(key);
    return { state: "logged" };
  }
}
