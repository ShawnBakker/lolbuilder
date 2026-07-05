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
import { HELPER_PROTOCOL, HELPER_VERSION } from "./version.js";
import { CalibrationStore } from "./calibration-store.js";
import { resolvePlatform } from "./platform.js";
import { logError } from "./sanitize.js";
import { validateSession } from "./validate.js";

export const PORT = 27437;
/**
 * Origin ALLOWLIST (expansion-decisions action item, 2026-07-05): a single
 * hardcoded origin baked into every distributed helper makes a future
 * domain migration a fleet-wide break. The list makes it a one-line edit.
 * First entry is the primary (used when no/unknown Origin — e.g. curl);
 * localhost entries serve local dev only and are loopback-bound anyway.
 */
export const ALLOWED_ORIGINS = [
  "https://shawnbakker.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
] as const;
export const ORIGIN = ALLOWED_ORIGINS[0];
const MAX_BODY = 64 * 1024;

export interface LcuBridge {
  /** null = no client (no lockfile); otherwise a GET against the LCU. */
  get(path: string): Promise<{ status: number; body: string }> | null;
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > MAX_BODY) {
        req.destroy();
        reject(new Error("body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export function createHelperServer(bridge: LcuBridge, store: CalibrationStore = new CalibrationStore()): Server {
  return createServer(async (req, res) => {
    const requestOrigin = req.headers.origin;
    const cors = {
      "Access-Control-Allow-Origin": requestOrigin && (ALLOWED_ORIGINS as readonly string[]).includes(requestOrigin) ? requestOrigin : ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Private-Network": "true",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
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
        if (!probe) return json(200, { ok: true, helperVersion: HELPER_VERSION, protocol: HELPER_PROTOCOL, lcu: "no-client" });
        const r = await probe.catch(() => null);
        return json(200, {
          ok: true,
          helperVersion: HELPER_VERSION,
          protocol: HELPER_PROTOCOL,
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
        return json(200, { state: "in-champ-select", helperVersion: HELPER_VERSION, protocol: HELPER_PROTOCOL, session: result.session });
      }

      if (req.url === "/calibration-log" && req.method === "POST") {
        // The calibration write channel (spec AC-C-1b): a LOCAL surface
        // between our own frontend and this helper. The read-only hard
        // line (no writes to the LCU or any RIOT surface) is untouched —
        // see the rescoped invariant test.
        let parsed: unknown;
        try {
          parsed = JSON.parse(await readBody(req));
        } catch {
          return json(400, { state: "invalid-entry", invariant: "entry-json" });
        }
        const platform = await resolvePlatform((p) => bridge.get(p));
        const result = store.append(parsed, platform);
        return json(result.state === "invalid-entry" ? 400 : 200, { ...result, protocol: HELPER_PROTOCOL });
      }

      json(404, { state: "unknown-route" });
    } catch (err) {
      logError("helper request failed:", err);
      json(500, { state: "helper-error" });
    }
  });
}
