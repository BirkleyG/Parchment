import { describe, expect, it } from "vitest";

import { validateMailboxName, validateUsername } from "@/lib/validations";

describe("validation helpers", () => {
  it("accepts clean lowercase mailbox names", () => {
    const result = validateMailboxName("willow.hollow");
    expect(result.valid).toBe(true);
    expect(result.normalizedValue).toBe("willow.hollow");
  });

  it("rejects mailbox names with spaces or uppercase letters", () => {
    expect(validateMailboxName("Willow Hollow").valid).toBe(false);
    expect(validateMailboxName("willow hollow").valid).toBe(false);
  });

  it("rejects crass mailbox names", () => {
    const result = validateMailboxName("quietshitriver");
    expect(result.valid).toBe(false);
  });

  it("normalizes usernames to lowercase and blocks short usernames", () => {
    expect(validateUsername(" Willow ").normalizedValue).toBe("willow");
    expect(validateUsername("ab").valid).toBe(false);
  });
});

