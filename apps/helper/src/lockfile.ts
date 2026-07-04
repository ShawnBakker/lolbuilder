/**
 * Lockfile discovery + parsing (AC-M7-5): default Windows install paths,
 * overridable via LEAGUE_LOCKFILE env or --lockfile=<path> — no code change
 * for a non-default install. Format: name:pid:port:password:protocol
 */
import { existsSync, readFileSync } from "node:fs";

export interface LcuCredentials {
  port: number;
  /** The auth token — a credential. Never logged; see sanitize.ts. */
  password: string;
  path: string;
}

export function parseLockfile(content: string, path: string): LcuCredentials {
  const parts = content.trim().split(":");
  if (parts.length < 5 || !Number.isInteger(Number(parts[2])) || !parts[3]) {
    throw new Error(`lockfile at ${path} does not match name:pid:port:password:protocol`);
  }
  return { port: Number(parts[2]), password: parts[3]!, path };
}

export function findLockfile(argv: string[] = process.argv): LcuCredentials | null {
  const cliArg = argv.find((a) => a.startsWith("--lockfile="))?.slice("--lockfile=".length);
  const candidates = [
    cliArg,
    process.env["LEAGUE_LOCKFILE"],
    "C:/Riot Games/League of Legends/lockfile",
    "D:/Riot Games/League of Legends/lockfile",
  ].filter((p): p is string => Boolean(p));
  for (const p of candidates) {
    if (existsSync(p)) return parseLockfile(readFileSync(p, "utf8"), p);
  }
  return null;
}
