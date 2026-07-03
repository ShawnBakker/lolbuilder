/**
 * M1 — narrow q-data deserializer + payload validators (plan §M1, spec F3).
 * Fail-loud by contract: every exported function throws QDataFormatViolation
 * on any deviation from the validated encoding model.
 */
export { QDataFormatViolation } from "./violation.js";
export {
  parsePayload,
  resolveRef,
  refToIndex,
  materialize,
  assertUniformRefEncoding,
  type QDataPayload,
} from "./graph.js";
export { extractBaseline, extractGameLength, extractMatchups } from "./extract.js";
export { extractBuilds } from "./builds.js";
export { extractSynergy } from "./synergy.js";
