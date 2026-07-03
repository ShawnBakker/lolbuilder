/**
 * Champion-level build extraction from the build-route payload (M6a).
 *
 * Shape (identified 2026-07-03 from production payloads): exactly one
 * two-key `{pick, win}` object whose refs resolve to summary hosts
 * `{skillpriority, skillorder, sums, runes, items}` — the site's
 * "most picked" and "highest win" build columns. Each host's `items` is a
 * set-group `{start, core, item4, item5, item6}`: start/core are ordered
 * sets with wr/n; item4–6 are per-slot option lists.
 */
import type { BuildSet, BuildSlotOption, BuildVariant, ChampionBuilds } from "@lolbuilder/types";
import { materialize, resolveRef, type QDataPayload } from "./graph.js";
import { violate } from "./violation.js";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function asBuildSet(raw: unknown, path: string): BuildSet {
  if (!isPlainObject(raw)) violate("builds-set", `${path} is not an object`);
  const { set, wr, n } = raw as Record<string, unknown>;
  if (!Array.isArray(set) || set.length === 0 || set.some((x) => !Number.isInteger(x))) {
    violate("builds-set", `${path}.set is not a non-empty item-id array`);
  }
  if (typeof wr !== "number" || !Number.isFinite(wr) || typeof n !== "number" || !Number.isFinite(n)) {
    violate("builds-numeric", `${path} wr/n not finite numbers`);
  }
  return { set: set as number[], wr, n };
}

function asOptions(raw: unknown, path: string): BuildSlotOption[] {
  // Slot options arrive as an array OR an object keyed "0","1",…
  const list = Array.isArray(raw) ? raw : isPlainObject(raw) ? Object.values(raw) : null;
  if (!list) violate("builds-options", `${path} is neither array nor indexed object`);
  return list.map((o, i) => {
    if (!isPlainObject(o)) violate("builds-options", `${path}[${i}] is not an object`);
    const { id, wr, n } = o as Record<string, unknown>;
    if (!Number.isInteger(id) || typeof wr !== "number" || !Number.isFinite(wr) || typeof n !== "number") {
      violate("builds-numeric", `${path}[${i}] id/wr/n malformed`);
    }
    return { id: id as number, wr: wr as number, n: n as number };
  });
}

function asVariant(payload: QDataPayload, hostRef: string, which: string): BuildVariant {
  const host = resolveRef(payload, hostRef);
  if (!isPlainObject(host) || !("items" in host)) {
    violate("builds-host", `${which} does not resolve to a summary host with .items`);
  }
  const items = materialize(payload, (host as Record<string, unknown>)["items"], `$.builds.${which}.items`);
  if (!isPlainObject(items)) violate("builds-items", `${which}.items did not materialize to an object`);
  for (const k of ["start", "core", "item4", "item5", "item6"]) {
    if (!(k in items)) violate("builds-items", `${which}.items lacks "${k}" (vs-route shape? wrong payload?)`);
  }
  return {
    start: asBuildSet(items["start"], `${which}.start`),
    core: asBuildSet(items["core"], `${which}.core`),
    options: {
      item4: asOptions(items["item4"], `${which}.item4`),
      item5: asOptions(items["item5"], `${which}.item5`),
      item6: asOptions(items["item6"], `${which}.item6`),
    },
  };
}

export function extractBuilds(payload: QDataPayload): ChampionBuilds {
  const pairs: Array<Record<string, unknown>> = [];
  for (const o of payload.objs) {
    if (isPlainObject(o) && Object.keys(o).length === 2 && "pick" in o && "win" in o) pairs.push(o);
  }
  if (pairs.length !== 1) {
    violate("builds-pair", `expected exactly 1 {pick,win} build pair, found ${pairs.length}`);
  }
  const pair = pairs[0]!;
  if (typeof pair["pick"] !== "string" || typeof pair["win"] !== "string") {
    violate("builds-pair", "pick/win slots are not refs");
  }
  return {
    win: asVariant(payload, pair["win"], "win"),
    pick: asVariant(payload, pair["pick"], "pick"),
  };
}
