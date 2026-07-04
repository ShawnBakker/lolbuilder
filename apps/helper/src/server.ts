/**
 * The helper's local HTTP surface (AC-M7-4/AC-M7-12): binds 127.0.0.1 only,
 * CORS scoped to the Pages origin, and answers Chrome's private-network
 * preflight with Access-Control-Allow-Private-Network: true — load-bearing
 * per PC-M7-1's server log (the probe's pass went THROUGH that gate).
 *
 * GET /health       -> { ok, helperVersion, lcu, phase? }   (AC-M7-14's helper half)
 * GET /champ-select -> { state: "in-champ-select", session } | named non-data states
 */
import { createServer, type Server } from "node:http";
import { HELPER_VERSION } from "./version.js";
import { logError } from "./sanitize.js";
import { validateSession } from "./validate.js";

export const PORT = 27437;
export const ORIGIN = "https://shawnbakker.github.io";

export interface LcuBridge {
  /** null = no client (no lockfile); otherwise a GET against the LCU. */
  get(path: string): Promise<{ status: number; body: string }> | null;
}

export function createHelperServer(bridge: LcuBridge): Server {
  return createServer(async (req, res) => {
    const cors = {
      "Access-Control-Allow-Origin": ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Private-Network": "true",
      "Access-Control-Max-Age": "600",
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      res.end();
      return;
    }
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { ...cors, "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };

    try {
      if (req.url === "/health") {
        const probe = bridge.get("/lol-gameflow/v1/gameflow-phase");
        if (!probe) return json(200, { ok: true, helperVersion: HELPER_VERSION, lcu: "no-client" });
        const r = await probe.catch(() => null);
        return json(200, {
          ok: true,
          helperVersion: HELPER_VERSION,
          lcu: r && r.status === 200 ? "connected" : "unreachable",
          phase: r && r.status === 200 ? JSON.parse(r.body) : undefined,
        });
      }

      if (req.url === "/champ-select") {
        const probe = bridge.get("/lol-champ-select/v1/session");
        if (!probe) return json(503, { state: "client-not-running" });
        const r = await probe.catch(() => null);
        if (!r) return json(503, { state: "client-unreachable" });
        if (r.status === 404) return json(200, { state: "not-in-champ-select" });
        if (r.status !== 200) return json(502, { state: "lcu-error", status: r.status });

        const result = validateSession(JSON.parse(r.body));
        if (!result.ok) {
          // AC-M7-6: loud, named, and the raw payload is NOT forwarded.
          logError(`champ-select payload violated [${result.invariant}]: ${result.detail} — serving unrecognized-payload, NOT the data`);
          return json(502, { state: "unrecognized-payload", invariant: result.invariant });
        }
        return json(200, { state: "in-champ-select", helperVersion: HELPER_VERSION, session: result.session });
      }

      json(404, { state: "unknown-route" });
    } catch (err) {
      logError("helper request failed:", err);
      json(500, { state: "helper-error" });
    }
  });
}
