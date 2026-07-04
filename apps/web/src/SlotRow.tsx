/**
 * One board slot (extracted M7.3 so AC-M7-8's marking is DOM-testable in
 * isolation). Presentational: all mutations flow back through callbacks the
 * App wires to the BoardSource. The lane <select> is BOTH the display and
 * the one-action correction — changing it on an inferred slot clears the
 * guess marking (the provider contract guarantees that).
 */
import { LANES, type Lane } from "@lolbuilder/types";
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
        value={slot.lane}
        className={slot.inferred ? "inferred-lane" : ""}
        title={slot.inferred ? `role INFERRED from pick rates (${Math.round(slot.inferred.share)}% ${slot.lane}) — change it if wrong` : undefined}
        onChange={(e) => onSetLane(e.target.value as Lane)}
        onClick={(e) => e.stopPropagation()}
      >
        {LANES.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      {slot.inferred && (
        <span className="inferred-badge" title="This role is a guess from pick-rate data, not from the game. Change the lane to correct it.">
          inferred {Math.round(slot.inferred.share)}%
        </span>
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
