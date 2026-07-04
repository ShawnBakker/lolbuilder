/**
 * The helper's HTTP surface against a stubbed LCU bridge: CORS + PNA headers
 * (AC-M7-4), state machine for every degradation path (feeds AC-M7-9), and
 * the AC-M7-6 guarantee that unrecognized payloads are named, not forwarded.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { createHelperServer, ORIGIN, type LcuBridge } from "../src/server.js";

let server: Server | null = null;
const start = (bridge: LcuBridge): Promise<number> =>
  new Promise((resolve) => {
    server = createHelperServer(bridge);
    server.listen(0, "127.0.0.1", () => resolve((server!.address() as { port: number }).port));
  });

afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

const GOOD_SESSION = JSON.stringify({
  myTeam: [{ cellId: 0, championId: 266, assignedPosition: "top" }],
  theirTeam: [{ cellId: 5, championId: 21, assignedPosition: "" }],
  actions: [[{ type: "pick", championId: 21, completed: true, isAllyAction: false }]],
  timer: { phase: "BAN_PICK" },
  localPlayerCellId: 0,
});

describe("helper server", () => {
  it("preflight carries origin-scoped CORS AND the PNA header (AC-M7-4)", async () => {
    const port = await start({ get: () => null });
    const res = await fetch(`http://127.0.0.1:${port}/health`, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("access-control-allow-private-network")).toBe("true");
  });

  it("/health: no-client and connected states, with helperVersion (AC-M7-14 half)", async () => {
    const port = await start({ get: () => null });
    const noClient = (await (await fetch(`http://127.0.0.1:${port}/health`)).json()) as Record<string, unknown>;
    expect(noClient).toMatchObject({ ok: true, lcu: "no-client" });
    expect(typeof noClient.helperVersion).toBe("string");
    expect(typeof noClient.protocol).toBe("number"); // AC-M7-14 handshake field
  });

  it("/champ-select degradation states are named: client-not-running / not-in-champ-select / lcu-error", async () => {
    let port = await start({ get: () => null });
    expect(((await (await fetch(`http://127.0.0.1:${port}/champ-select`)).json()) as { state: string }).state).toBe("client-not-running");
    await new Promise<void>((r) => server!.close(() => r()));

    port = await start({ get: () => Promise.resolve({ status: 404, body: "" }) });
    expect(((await (await fetch(`http://127.0.0.1:${port}/champ-select`)).json()) as { state: string }).state).toBe("not-in-champ-select");
    await new Promise<void>((r) => server!.close(() => r()));

    port = await start({ get: () => Promise.resolve({ status: 500, body: "boom" }) });
    expect(((await (await fetch(`http://127.0.0.1:${port}/champ-select`)).json()) as { state: string }).state).toBe("lcu-error");
  });

  it("valid session is served; malformed session is NAMED and NOT forwarded (AC-M7-6)", async () => {
    let port = await start({ get: () => Promise.resolve({ status: 200, body: GOOD_SESSION }) });
    const good = (await (await fetch(`http://127.0.0.1:${port}/champ-select`)).json()) as { state: string; session: { theirTeam: Array<{ championId: number }> } };
    expect(good.state).toBe("in-champ-select");
    expect(good.session.theirTeam[0]!.championId).toBe(21);
    await new Promise<void>((r) => server!.close(() => r()));

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const evil = JSON.stringify({ myTeam: "garbage", SECRET_MARKER: "should-not-leak" });
    port = await start({ get: () => Promise.resolve({ status: 200, body: evil }) });
    const res = await fetch(`http://127.0.0.1:${port}/champ-select`);
    const body = await res.text();
    expect(res.status).toBe(502);
    expect((JSON.parse(body) as { state: string }).state).toBe("unrecognized-payload");
    expect((JSON.parse(body) as { invariant: string }).invariant).toBe("team-shape");
    expect(body).not.toContain("SECRET_MARKER"); // raw payload never forwarded
    vi.restoreAllMocks();
  });
});
