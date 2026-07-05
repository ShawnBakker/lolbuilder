/**
 * lolbuilder helper — run with: pnpm --filter @lolbuilder/helper dev
 * (or, once packaged per OI-M7-3: node helper.mjs)
 *
 * Read-only against the League client. Local-only. The lockfile token never
 * appears in any output (sanitize.ts). See the install doc (M7.5).
 */
import { findLockfile } from "./lockfile.js";
import { lcuGet } from "./lcu.js";
import { reconcileOutcomes } from "./reconcile.js";
import { armRedaction, log, logError } from "./sanitize.js";
import { createHelperServer, ORIGIN, PORT } from "./server.js";
import { HELPER_VERSION } from "./version.js";

const server = createHelperServer({
  get(path) {
    const creds = findLockfile();
    if (!creds) return null;
    armRedaction(creds.password); // re-armed every lookup: client restarts rotate the token
    return lcuGet(creds, path);
  },
});

server.listen(PORT, "127.0.0.1", () => {
  const creds = findLockfile();
  if (creds) armRedaction(creds.password);
  log(`lolbuilder helper v${HELPER_VERSION} listening on http://127.0.0.1:${PORT}`);
  log(`serving champ-select state to ${ORIGIN} — reads your client, never writes to it; the only write is the local calibration log`);
  log(creds ? `League client found (lockfile: ${creds.path})` : "League client not detected yet — will connect when it starts");
  // C.1 (OI-C-2 resolved: on-launch reconciliation). Fire-and-forget:
  // reconcile failures never affect the serving surface.
  void reconcileOutcomes().catch((err) => logError("outcome reconcile crashed (serving unaffected):", err));
});
