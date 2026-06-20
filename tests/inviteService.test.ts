import { describe, expect, it } from "vitest";

import { buildInviteMessage, buildInviteUrl } from "@/lib/inviteService";

describe("inviteService helpers", () => {
  it("builds a claim url from the current origin and token", () => {
    expect(buildInviteUrl("https://parchment.example", "abc123")).toBe(
      "https://parchment.example/invite/abc123",
    );
  });

  it("builds the default invitation message around the link", () => {
    const link = "https://parchment.example/invite/abc123";
    expect(buildInviteMessage(link)).toContain(link);
    expect(buildInviteMessage(link)).toContain("You have been sent a letter from me");
  });
});
