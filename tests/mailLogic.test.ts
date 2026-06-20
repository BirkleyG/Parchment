import { describe, expect, it } from "vitest";

import { applyDeliverySync, canSwitchWritingMode, isWritingLocked } from "@/lib/mailLogic";
import type { Letter } from "@/lib/types";

function baseLetter(overrides: Partial<Letter> = {}): Letter {
  return {
    id: "l-1",
    fromName: "Lily",
    fromMailboxName: "softseasons",
    toName: "Emma",
    toMailboxName: "willowhollow",
    title: "",
    body: "",
    status: "draft",
    createdAt: new Date("2026-05-01T00:00:00.000Z").toISOString(),
    writingMode: "fountainPen",
    ...overrides,
  };
}

describe("mailLogic", () => {
  it("locks writing mode once content exists", () => {
    expect(isWritingLocked({ title: "", body: "" })).toBe(false);
    expect(isWritingLocked({ title: "hello", body: "" })).toBe(true);
    expect(isWritingLocked({ title: "", body: "hello" })).toBe(true);
  });

  it("allows writing mode switch only while letter is empty", () => {
    expect(
      canSwitchWritingMode({ title: "", body: "" }, "typewriter", "fountainPen"),
    ).toBe(true);
    expect(
      canSwitchWritingMode({ title: "Warm hello", body: "" }, "typewriter", "fountainPen"),
    ).toBe(false);
  });

  it("promotes in-transit letters when delivery date has passed", () => {
    const nowMinusDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const nowPlusDay = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { deliverableIds, updatedLetters } = applyDeliverySync([
      baseLetter({ id: "a", status: "inTransit", deliveredAt: nowMinusDay }),
      baseLetter({ id: "b", status: "inTransit", deliveredAt: nowPlusDay }),
      baseLetter({ id: "c", status: "opened" }),
    ]);

    expect(deliverableIds).toEqual(["a"]);
    expect(updatedLetters.find((entry) => entry.id === "a")?.status).toBe("delivered");
    expect(updatedLetters.find((entry) => entry.id === "b")?.status).toBe("inTransit");
    expect(updatedLetters.find((entry) => entry.id === "c")?.status).toBe("opened");
  });
});

