/**
 * Minimal LCU client — the hand-rolled ~50 lines PC-M7-2 licensed.
 * READ-ONLY BY CONSTRUCTION (AC-M7-3): this module exposes exactly one
 * function and it is a GET; no write verb exists anywhere in the helper
 * (enforced by a source-grep test). Local-only: 127.0.0.1, basic auth from
 * the lockfile, self-signed cert accepted (the LCU's own cert; the
 * connection never leaves the machine).
 */
import https from "node:https";
import type { LcuCredentials } from "./lockfile.js";

export interface LcuResponse {
  status: number;
  body: string;
}

export function lcuGet(creds: LcuCredentials, path: string): Promise<LcuResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: "127.0.0.1",
        port: creds.port,
        path,
        method: "GET",
        headers: { Authorization: "Basic " + Buffer.from(`riot:${creds.password}`).toString("base64") },
        rejectUnauthorized: false,
        timeout: 3000,
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("LCU request timeout")));
    req.on("error", reject);
    req.end();
  });
}
