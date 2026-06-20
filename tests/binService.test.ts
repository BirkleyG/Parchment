import { describe, expect, it } from "vitest";

import { canDeleteBin } from "@/lib/binService";
import type { Letter } from "@/lib/types";

function letter(overrides: Partial<Letter> = {}): Letter {
  return {
    id: "letter-1",
    fromName: "A",
    fromMailboxName: "a",
    toName: "B",
    toMailboxName: "b",
    title: "Title",
    body: "Body",
    status: "delivered",
    createdAt: new Date().toISOString(),
    writingMode: "fountainPen",
    ...overrides,
  };
}

describe("canDeleteBin", () => {
  it("prevents deleting default bins", () => {
    expect(canDeleteBin("friends", [])).toBe(false);
    expect(canDeleteBin("unopened", [])).toBe(false);
  });

  it("prevents deleting bins that still contain letters", () => {
    expect(canDeleteBin("memories", [letter({ binId: "memories" })])).toBe(false);
  });

  it("allows deleting custom empty bins", () => {
    expect(canDeleteBin("autumn-notes", [letter({ binId: "friends" })])).toBe(true);
  });
});

