/**
 * Every deserializer failure is a named-invariant violation. Parser failure
 * is a schema-change alarm, never a recoverable warning (CLAUDE.md hard rule):
 * callers must let these propagate — corrupt shards must not reach scoring.
 */
export class QDataFormatViolation extends Error {
  readonly invariant: string;

  constructor(invariant: string, detail?: string) {
    super(`q-data format violation [${invariant}]${detail ? `: ${detail}` : ""}`);
    this.name = "QDataFormatViolation";
    this.invariant = invariant;
  }
}

export function violate(invariant: string, detail?: string): never {
  throw new QDataFormatViolation(invariant, detail);
}
