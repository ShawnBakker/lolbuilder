/**
 * Patch identity — three formats, one patch (CLAUDE.md domain constants):
 *   live `26.NN` ↔ Data Dragon `16.NN.1` ↔ lolalytics `patch=16.NN`
 *
 * The live↔DDragon major offset (26↔16, i.e. −10) is the observed contract
 * for the 25.x/15.x and 26.x/16.x eras, validated live 2026-07-02. It is an
 * era assumption: re-verify at season rollover before trusting a new major.
 * All converters throw on unexpected shapes — fail loudly, never guess.
 */

const LIVE_RE = /^(\d{2})\.(\d{1,2})$/;
const DDRAGON_RE = /^(\d{2})\.(\d{1,2})\.1$/;
const LOLALYTICS_RE = /^(\d{2})\.(\d{1,2})$/;

const MAJOR_OFFSET = 10;

function parseOrThrow(re: RegExp, value: string, expected: string): [number, number] {
  const m = re.exec(value);
  if (!m) {
    throw new Error(`patch format violation: "${value}" does not match expected ${expected}`);
  }
  return [Number(m[1]), Number(m[2])];
}

/** `26.13` → `16.13.1` */
export function liveToDDragon(live: string): string {
  const [major, minor] = parseOrThrow(LIVE_RE, live, "live patch (e.g. 26.13)");
  return `${major - MAJOR_OFFSET}.${minor}.1`;
}

/** `16.13.1` → `26.13` */
export function ddragonToLive(ddragon: string): string {
  const [major, minor] = parseOrThrow(DDRAGON_RE, ddragon, "DDragon patch (e.g. 16.13.1)");
  return `${major + MAJOR_OFFSET}.${minor}`;
}

/** `16.13.1` → `16.13` */
export function ddragonToLolalytics(ddragon: string): string {
  const [major, minor] = parseOrThrow(DDRAGON_RE, ddragon, "DDragon patch (e.g. 16.13.1)");
  return `${major}.${minor}`;
}

/** `26.13` → `16.13` */
export function liveToLolalytics(live: string): string {
  return ddragonToLolalytics(liveToDDragon(live));
}

/** `16.13` → `16.13.1` */
export function lolalyticsToDDragon(lolalytics: string): string {
  const [major, minor] = parseOrThrow(LOLALYTICS_RE, lolalytics, "lolalytics patch (e.g. 16.13)");
  return `${major}.${minor}.1`;
}
