/**
 * Mechanical resolution of the Qwik route-loader object graph — deliberately
 * narrow, NOT a general Qwik deserializer (AC-8).
 *
 * Verified encoding model (fixture-scale, 2026-07-03; zero exceptions across
 * 8 payloads / 2 capture days):
 *   - payload = { _entry: <ref>, _objs: unknown[] }
 *   - every container slot (object field, array element) inside _objs is a
 *     canonical, in-range base-36 ref string;
 *   - primitives (number/string/boolean) exist only as top-level _objs entries;
 *   - resolution is SINGLE HOP: a resolved string is a value, never re-chased
 *     (a value like "13" must not be mistaken for another ref).
 *
 * Any deviation from this model is a format violation — which is precisely
 * the schema-drift alarm D7 wants, so we check it eagerly and loudly.
 */

import { violate } from "./violation.js";

export interface QDataPayload {
  readonly entryRef: string;
  readonly objs: readonly unknown[];
}

export function parsePayload(json: unknown): QDataPayload {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    violate("root-shape", "payload is not an object");
  }
  const root = json as Record<string, unknown>;
  if (typeof root["_entry"] !== "string") {
    violate("root-entry", "_entry missing or not a string");
  }
  if (!Array.isArray(root["_objs"]) || root["_objs"].length === 0) {
    violate("root-objs", "_objs missing, not an array, or empty");
  }
  return { entryRef: root["_entry"] as string, objs: root["_objs"] as unknown[] };
}

/** Canonical base-36 ref → index, or a violation. */
export function refToIndex(payload: QDataPayload, ref: string): number {
  const index = parseInt(ref, 36);
  if (!Number.isInteger(index) || index < 0 || index >= payload.objs.length || index.toString(36) !== ref) {
    violate("ref-canonical", `"${ref}" is not a canonical in-range base-36 ref (objs length ${payload.objs.length})`);
  }
  return index;
}

/** Single-hop resolution of one ref. */
export function resolveRef(payload: QDataPayload, ref: string): unknown {
  return payload.objs[refToIndex(payload, ref)];
}

/**
 * Materialize a container into plain data by resolving every slot one hop,
 * recursing into containers. `path` is threaded for diagnostics.
 */
export function materialize(payload: QDataPayload, value: unknown, path = "$", depth = 0): unknown {
  if (depth > 32) {
    violate("materialize-depth", `exceeded depth 32 at ${path} (cycle or unexpected nesting)`);
  }
  if (typeof value === "string") {
    // A string slot is a ref; its target is a value (single hop) unless the
    // target is itself a container, which we then materialize.
    const target = resolveRef(payload, value);
    if (target !== null && typeof target === "object") {
      return materialize(payload, target, path, depth + 1);
    }
    return target;
  }
  if (Array.isArray(value)) {
    return value.map((slot, i) => {
      if (typeof slot !== "string") {
        violate("container-slot-ref", `non-ref slot at ${path}[${i}] (type ${typeof slot}) — encoding model changed`);
      }
      return materialize(payload, slot, `${path}[${i}]`, depth + 1);
    });
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, slot] of Object.entries(value)) {
      if (typeof slot !== "string") {
        violate("container-slot-ref", `non-ref slot at ${path}.${key} (type ${typeof slot}) — encoding model changed`);
      }
      out[key] = materialize(payload, slot, `${path}.${key}`, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * The uniform-ref-encoding drift alarm (AC-9): every container slot in the
 * whole graph is a canonical in-range base-36 ref. Runs over raw _objs.
 */
export function assertUniformRefEncoding(payload: QDataPayload): void {
  payload.objs.forEach((entry, i) => {
    if (entry === null || typeof entry !== "object") return;
    const slots: Array<[string, unknown]> = Array.isArray(entry)
      ? entry.map((v, j) => [`[${j}]`, v] as [string, unknown])
      : Object.entries(entry);
    for (const [where, slot] of slots) {
      if (typeof slot !== "string") {
        violate("container-slot-ref", `non-ref slot at _objs[${i}]${where.startsWith("[") ? where : "." + where} (type ${typeof slot})`);
      }
      refToIndex(payload, slot);
    }
  });
}
