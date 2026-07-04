/**
 * AC-M7-8's UI half (the reviewer's first hard-look item): a guessed role
 * is VISIBLY a guess, with its evidence, and correctable in exactly one
 * action — which clears the marking. Real DOM events, per the house rule.
 */
// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SlotRow } from "../src/SlotRow.js";
import { ManualProvider, type BoardSlot } from "../src/provider.js";

afterEach(cleanup);

const inferredSlot: BoardSlot = { side: "enemy", index: 1, lane: "jungle", cid: 121, inferred: { share: 99.3 } };
const manualSlot: BoardSlot = { side: "enemy", index: 2, lane: "top", cid: 122 };

const renderRow = (slot: BoardSlot, onSetLane = vi.fn()) => {
  render(
    <SlotRow slot={slot} champName="X" isPick={false} isSelected={false} onSelect={vi.fn()} onSetLane={onSetLane} onClear={vi.fn()} />,
  );
  return onSetLane;
};

describe("inferred-role marking (AC-M7-8)", () => {
  it("an inferred role is visibly a guess, with its evidence", () => {
    renderRow(inferredSlot);
    const badge = screen.getByText("inferred 99%");
    expect(badge.className).toBe("inferred-badge");
    expect(screen.getByRole("combobox").className).toContain("inferred-lane");
    expect(screen.getByRole("combobox").title).toContain("INFERRED");
  });

  it("a human-chosen role carries NO guess marking", () => {
    renderRow(manualSlot);
    expect(screen.queryByText(/inferred/)).toBeNull();
    expect(screen.getByRole("combobox").className).not.toContain("inferred-lane");
  });

  it("correction is ONE action: changing the lane select fires the callback", async () => {
    const user = userEvent.setup();
    const onSetLane = renderRow(inferredSlot);
    await user.selectOptions(screen.getByRole("combobox"), "top");
    expect(onSetLane).toHaveBeenCalledExactlyOnceWith("top");
  });

  it("the provider contract clears the marking on manual setLane (guess must not survive a human choice)", () => {
    const p = new ManualProvider();
    p.assign("enemy", 1, 121);
    // simulate an inference having been applied to the live slot (LcuProvider's job in M7.4)
    const slot = p.slots().find((s) => s.side === "enemy" && s.index === 1)! as BoardSlot;
    slot.inferred = { share: 99.3 };
    p.setLane("enemy", 1, "top");
    expect(slot.inferred).toBeUndefined();
    expect(slot.lane).toBe("top");
  });
});
