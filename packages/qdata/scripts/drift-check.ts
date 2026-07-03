/**
 * Weekly drift alarm (AC-10): refetch one live payload and run the full
 * invariant set against it. Runs from GitHub Actions, so a pass also
 * re-confirms the D5 datacenter-IP-class assumption (same-IP-class canary).
 * Any QDataFormatViolation exits non-zero → red workflow → schema-change alarm.
 */
import { assertUniformRefEncoding, extractGameLength, parsePayload } from "../src/index.js";

const URL = "https://lolalytics.com/lol/aatrox/build/q-data.json";
const UA = "lolbuilder-drift-check (github.com/ShawnBakker/lolbuilder)";

const res = await fetch(URL, { headers: { "user-agent": UA } });
if (!res.ok) {
  throw new Error(`drift-check fetch failed: HTTP ${res.status} for ${URL} (possible IP-class posture change — see D5)`);
}
const payload = parsePayload(await res.json());
assertUniformRefEncoding(payload);
const { time, timeWin } = extractGameLength(payload);
const games = Object.values(time).reduce((a, b) => a + b, 0);
const wins = Object.values(timeWin).reduce((a, b) => a + b, 0);
console.log(
  `drift-check OK: ${payload.objs.length} graph entries, uniform ref encoding, ` +
    `7 buckets (${games} games, ${((wins / games) * 100).toFixed(1)}% wr)`,
);
