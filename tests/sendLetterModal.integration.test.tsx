import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SendLetterModal } from "@/components/SendLetterModal";

describe("SendLetterModal", () => {
  it("shows both send options by default", () => {
    const lookup = vi.fn().mockResolvedValue(null);
    const send = vi.fn().mockResolvedValue(undefined);

    render(
      <SendLetterModal
        open
        initialSenderName="Lily"
        initialTitle="Thinking of you"
        onLookup={lookup}
        onSend={send}
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Find in Registry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not Yet on Parchment" })).toBeInTheDocument();
  });

  it("shows gentle address error when registry recipient is not found", async () => {
    const user = userEvent.setup();
    const lookup = vi.fn().mockResolvedValue(null);
    const send = vi.fn().mockResolvedValue(undefined);

    render(
      <SendLetterModal
        open
        initialSenderName="Lily"
        initialTitle="Thinking of you"
        onLookup={lookup}
        onSend={send}
        onClose={() => {}}
      />,
    );

    await user.type(screen.getByPlaceholderText("@willowhollow"), "unknown");
    await user.click(screen.getByRole("button", { name: "Find" }));

    expect(
      await screen.findByText("No address by that name was found in the registry."),
    ).toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
  });

  it("sends payload after recipient lookup succeeds", async () => {
    const user = userEvent.setup();
    const lookup = vi.fn().mockResolvedValue({
      id: "u-1",
      firstName: "Emma",
      lastName: "Green",
      mailboxName: "willowhollow",
      includedInRegistry: true,
    });
    const send = vi.fn().mockResolvedValue(undefined);

    render(
      <SendLetterModal
        open
        initialSenderName="Lily"
        initialTitle="Thinking of you"
        onLookup={lookup}
        onSend={send}
        onClose={() => {}}
      />,
    );

    await user.type(screen.getByPlaceholderText("@willowhollow"), "willowhollow");
    await user.click(screen.getByRole("button", { name: "Find" }));

    await screen.findByText("Address found: Emma Green");
    await user.click(screen.getByRole("button", { name: "Seal and Send" }));

    expect(send).toHaveBeenCalledWith({
      kind: "registry",
      recipientMailboxName: "willowhollow",
      senderDisplayName: "Lily",
      title: "Thinking of you",
    });
  });

  it("sends off-platform invite payload without registry lookup", async () => {
    const user = userEvent.setup();
    const lookup = vi.fn().mockResolvedValue(null);
    const send = vi.fn().mockResolvedValue(undefined);

    render(
      <SendLetterModal
        open
        initialSenderName="Lily"
        initialTitle="Thinking of you"
        onLookup={lookup}
        onSend={send}
        onClose={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Not Yet on Parchment" }));
    await user.type(screen.getByPlaceholderText("Anna Lee"), "Anna Lee");
    await user.click(screen.getByRole("button", { name: "Seal and Send" }));

    expect(lookup).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith({
      kind: "invite",
      recipientName: "Anna Lee",
      senderDisplayName: "Lily",
      title: "Thinking of you",
    });
  });

  it("clears registry errors when switching to invite mode", async () => {
    const user = userEvent.setup();
    const lookup = vi.fn().mockResolvedValue(null);
    const send = vi.fn().mockResolvedValue(undefined);

    render(
      <SendLetterModal
        open
        initialSenderName="Lily"
        initialTitle="Thinking of you"
        onLookup={lookup}
        onSend={send}
        onClose={() => {}}
      />,
    );

    await user.type(screen.getByPlaceholderText("@willowhollow"), "unknown");
    await user.click(screen.getByRole("button", { name: "Find" }));
    expect(await screen.findByText("No address by that name was found in the registry.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Not Yet on Parchment" }));

    expect(screen.queryByText("No address by that name was found in the registry.")).not.toBeInTheDocument();
  });
});
