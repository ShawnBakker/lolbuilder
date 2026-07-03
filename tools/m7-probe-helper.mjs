/**
 * M7 mixed-content probe — local half (see m7-lcu-brainstorm.md §8 Q1 +
 * review addendum). A stub of the future LCU helper's HTTP surface with
 * CORS and private-network preflight handled CORRECTLY, so that if the
 * browser blocks the fetch, the failure indicts browser policy — not a
 * misconfigured server.
 *
 * Run:   node tools/m7-probe-helper.mjs
 * Then:  open https://shawnbakker.github.io/lolbuilder/m7-probe.html
 */
import { createServer } from "node:http";

const PORT = 27437;
const ORIGIN = "https://shawnbakker.github.io";

const server = createServer((req, res) => {
  const cors = {
    "Access-Control-Allow-Origin": ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    // Chrome private/local network access preflight:
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "600",
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    console.log(`preflight from origin=${req.headers.origin ?? "?"} acrpn=${req.headers["access-control-request-private-network"] ?? "-"}`);
    return;
  }
  res.writeHead(200, { ...cors, "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, probe: "m7-mixed-content", helperVersion: "probe-1" }));
  console.log(`GET ${req.url} from origin=${req.headers.origin ?? "?"}`);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`m7 probe helper listening on http://127.0.0.1:${PORT} (and http://localhost:${PORT})`);
  console.log(`now open: ${ORIGIN}/lolbuilder/m7-probe.html`);
});
