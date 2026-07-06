/**
 * One board slot (extracted M7.3 so AC-M7-8's marking is DOM-testable in
 * isolation). Presentational: all mutations flow back through callbacks the
 * App wires to the BoardSource. The lane <select> is BOTH the display and
 * the one-action correction — changing it on an inferred slot clears the
 * guess marking (the provider contract guarantees that).
 */
import { LANES, type Lane } from "@lolbuilder/types";
import { champIconUrl } from "./data.js";
import type { BoardSlot } from "./provider.js";

export interface SlotRowProps {
  slot: BoardSlot;
  champName: string | null;
  isPick: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onSetLane: (lane: Lane) => void;
  onClear: () => void;
}

export function SlotRow({ slot, champName, isPick, isSelected, onSelect, onSetLane, onClear }: SlotRowProps) {
  return (
    <div className={`slot ${isSelected ? "sel" : ""}`} onClick={onSelect}>
      <select
        value={slot.unknownRole ? "" : slot.lane}
        className={slot.unknownRole ? "unknown-lane" : slot.inferred ? "inferred-lane" : ""}
        title={
          slot.unknownRole
            ? "No confident role guess for this champion — assign one; it is excluded from scoring until you do."
            : slot.inferred
              ? `role INFERRED from pick rates (${Math.round(slot.inferred.share)}% ${slot.lane}) — change it if wrong`
              : undefined
        }
        onChange={(e) => onSetLane(e.target.value as Lane)}
        onClick={(e) => e.stopPropagation()}
      >
        {slot.unknownRole && (
          <option value="" disabled>
            —
          </option>
        )}
        {LANES.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      {slot.unknownRole && slot.cid !== null && (
        <span className="inferred-badge unknown" title="Blank beats wrong: no lane clears the confidence bar, so this enemy is left out of scoring until you assign one.">
          role needed
        </span>
      )}
      {!slot.unknownRole && slot.inferred && (
        <span className="inferred-badge" title="This role is a guess from pick-rate data, not from the game. Change the lane to correct it.">
          inferred {Math.round(slot.inferred.share)}%
        </span>
      )}
      {slot.cid !== null && champIconUrl(slot.cid) && (
        <img className="champ-icon" src={champIconUrl(slot.cid)!} alt="" width={30} height={30} loading="lazy" />
      )}
      <span className="who">
        {isPick ? "★ " : ""}
        {champName ?? <em>empty{isPick ? " — your pick" : ""}</em>}
      </span>
      {champName && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
