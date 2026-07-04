/**
 * Champ-select payload validation (AC-M7-6): the LCU is unversioned and
 * unsupported; on shape drift the helper fails LOUDLY and serves a named
 * violation — it never forwards unrecognized data to the board. Same
 * discipline as the qdata deserializer. Shapes are what PC-M7-3 observed
 * across 19 real-draft snapshots.
 */

export interface SessionSlot {
  cellId: number;
  championId: number;
  assignedPosition: string;
}

export interface ValidSession {
  myTeam: SessionSlot[];
  theirTeam: SessionSlot[];
  actions: Array<Array<{ type: string; championId: number; completed: boolean; isAllyAction: boolean }>>;
  timerPhase: string;
  localPlayerCellId: number;
}

export type ValidationResult = { ok: true; session: ValidSession } | { ok: false; invariant: string; detail: string };

const fail = (invariant: string, detail: string): ValidationResult => ({ ok: false, invariant, detail });

function team(raw: unknown, which: string): SessionSlot[] | string {
  if (!Array.isArray(raw)) return `${which} is not an array`;
  const out: SessionSlot[] = [];
  for (const [i, p] of raw.entries()) {
    if (p === null || typeof p !== "object") return `${which}[${i}] is not an object`;
    const { cellId, championId, assignedPosition } = p as Record<string, unknown>;
    if (!Number.isInteger(cellId) || !Number.isInteger(championId)) return `${which}[${i}] cellId/championId not integers`;
    out.push({ cellId: cellId as number, championId: championId as number, assignedPosition: typeof assignedPosition === "string" ? assignedPosition : "" });
  }
  return out;
}

export function validateSession(raw: unknown): ValidationResult {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return fail("session-shape", "payload is not an object");
  const s = raw as Record<string, unknown>;

  const myTeam = team(s["myTeam"], "myTeam");
  if (typeof myTeam === "string") return fail("team-shape", myTeam);
  const theirTeam = team(s["theirTeam"], "theirTeam");
  if (typeof theirTeam === "string") return fail("team-shape", theirTeam);

  if (!Array.isArray(s["actions"]) || s["actions"].some((g) => !Array.isArray(g))) {
    return fail("actions-shape", "actions is not an array of arrays");
  }
  const actions = (s["actions"] as unknown[][]).map((g) =>
    g.map((a) => {
      const { type, championId, completed, isAllyAction } = (a ?? {}) as Record<string, unknown>;
      return {
        type: String(type ?? ""),
        championId: Number.isInteger(championId) ? (championId as number) : 0,
        completed: completed === true,
        isAllyAction: isAllyAction === true,
      };
    }),
  );

  const timer = s["timer"];
  if (timer === null || typeof timer !== "object" || typeof (timer as Record<string, unknown>)["phase"] !== "string") {
    return fail("timer-shape", "timer.phase missing or not a string");
  }
  if (!Number.isInteger(s["localPlayerCellId"])) return fail("session-shape", "localPlayerCellId missing");

  return {
    ok: true,
    session: {
      myTeam,
      theirTeam,
      actions,
      timerPhase: (timer as Record<string, unknown>)["phase"] as string,
      localPlayerCellId: s["localPlayerCellId"] as number,
    },
  };
}
