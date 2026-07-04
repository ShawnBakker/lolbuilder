/**
 * THE diagnostics chokepoint (AC-M7-11). Every piece of output the helper
 * produces — logs, errors, anything a friend might copy-paste into Discord —
 * routes through here, and the lockfile token is redacted the moment it is
 * known. No other module may call console directly (enforced by a test that
 * greps the source). The mechanism IS the AC.
 */
let token: string | null = null;

export function armRedaction(lockfileToken: string): void {
  token = lockfileToken;
}

export function redact(value: unknown): string {
  const s = typeof value === "string" ? value : value instanceof Error ? `${value.name}: ${value.message}\n${value.stack ?? ""}` : JSON.stringify(value);
  return token ? String(s).split(token).join("[REDACTED-TOKEN]") : String(s);
}

export function log(...parts: unknown[]): void {
  console.log(parts.map(redact).join(" "));
}

export function logError(...parts: unknown[]): void {
  console.error(parts.map(redact).join(" "));
}
