"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ParchmentDialog } from "@/components/ParchmentDialog";
import type { RegistryUser, SendDraftPayload } from "@/lib/types";

type DeliveryMode = "registry" | "invite";

type SendLetterModalProps = {
  open: boolean;
  initialSenderName: string;
  initialTitle: string;
  initialRecipientMailboxName?: string;
  onLookup: (mailbox: string) => Promise<RegistryUser | null>;
  onClose: () => void;
  onSend: (payload: SendDraftPayload) => Promise<void>;
};

export function SendLetterModal({
  open,
  initialSenderName,
  initialTitle,
  initialRecipientMailboxName = "",
  onLookup,
  onClose,
  onSend,
}: SendLetterModalProps) {
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("registry");
  const [recipientMailboxName, setRecipientMailboxName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [senderDisplayName, setSenderDisplayName] = useState(initialSenderName);
  const [title, setTitle] = useState(initialTitle);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<RegistryUser | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDeliveryMode(initialRecipientMailboxName ? "registry" : "registry");
    setRecipientMailboxName(initialRecipientMailboxName);
    setRecipientName("");
    setLookupError(null);
    setSendError(null);
    setRecipient(null);
    setSenderDisplayName(initialSenderName);
    setTitle(initialTitle);
  }, [initialRecipientMailboxName, initialSenderName, initialTitle, open]);

  const lookupDisabled = useMemo(
    () => recipientMailboxName.trim().length === 0 || lookupLoading,
    [lookupLoading, recipientMailboxName],
  );

  const registryReady = Boolean(recipient);
  const inviteReady = recipientName.trim().length > 0;

  const handleLookup = useCallback(async (recipientOverride?: string) => {
    const target = (recipientOverride ?? recipientMailboxName).trim().replace(/^@/, "").toLowerCase();
    if (!target) {
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    setSendError(null);
    setRecipient(null);

    try {
      const match = await onLookup(target);

      if (!match) {
        setLookupError("No address by that name was found in the registry.");
        return;
      }

      setRecipient(match);
    } finally {
      setLookupLoading(false);
    }
  }, [onLookup, recipientMailboxName]);

  useEffect(() => {
    if (!open || !initialRecipientMailboxName) {
      return;
    }

    void handleLookup(initialRecipientMailboxName);
  }, [handleLookup, initialRecipientMailboxName, open]);

  async function handleSend() {
    setIsSending(true);
    setSendError(null);

    try {
      if (deliveryMode === "registry") {
        await onSend({
          kind: "registry",
          recipientMailboxName,
          senderDisplayName,
          title,
        });
      } else {
        await onSend({
          kind: "invite",
          recipientName,
          senderDisplayName,
          title,
        });
      }

      onClose();
    } catch (caughtError) {
      setSendError(caughtError instanceof Error ? caughtError.message : "Unable to send your letter.");
    } finally {
      setIsSending(false);
    }
  }

  const sendDisabled = isSending || (deliveryMode === "registry" ? !registryReady : !inviteReady);

  return (
    <ParchmentDialog open={open} onClose={onClose} contentClassName="parchment-dialog-panel-lg">
      <p className="parchment-dialog-title">Prepare to Send</p>
      <p className="parchment-dialog-copy">
        Choose how this letter should travel. Registry recipients can be addressed directly, or you can generate a shareable invitation for someone still joining Parchment.
      </p>

      <div className="send-delivery-mode-row" role="tablist" aria-label="Delivery options">
        <button
          type="button"
          className={`${deliveryMode === "registry" ? "paper-button send-delivery-mode-button-active" : "secondary-button"} send-delivery-mode-button`}
          onClick={() => {
            setDeliveryMode("registry");
            setLookupError(null);
            setSendError(null);
          }}
        >
          Find in Registry
        </button>
        <button
          type="button"
          className={`${deliveryMode === "invite" ? "paper-button send-delivery-mode-button-active" : "secondary-button"} send-delivery-mode-button`}
          onClick={() => {
            setDeliveryMode("invite");
            setLookupError(null);
            setSendError(null);
          }}
        >
          Not Yet on Parchment
        </button>
      </div>

      <div className="space-y-5">
        {deliveryMode === "registry" ? (
          <>
            <label className="block space-y-2">
              <span className="auth-label">Recipient Mailbox</span>
              <div className="mt-1 flex gap-2 send-lookup-row">
                <input
                  value={recipientMailboxName}
                  onChange={(event) => {
                    setRecipientMailboxName(event.target.value);
                    setRecipient(null);
                    setLookupError(null);
                    setSendError(null);
                  }}
                  placeholder="@willowhollow"
                  className="paper-input flex-1"
                />
                <button
                  type="button"
                  onClick={() => void handleLookup()}
                  disabled={lookupDisabled}
                  className="paper-button"
                >
                  {lookupLoading ? "Searching..." : "Find"}
                </button>
              </div>
            </label>

            {recipient ? (
              <p className="text-sm text-[var(--color-text-soft)]">
                Address found: {recipient.firstName} {recipient.lastName}
              </p>
            ) : null}
            {lookupError ? <p className="text-sm text-[var(--color-danger)]">{lookupError}</p> : null}
          </>
        ) : (
          <div className="send-invite-card">
            <p className="send-invite-card-title">Invite someone into the correspondence</p>
            <p className="send-invite-card-copy">
              We will generate a one-time invitation link and a ready-to-send message so you can share the letter yourself.
            </p>
            <label className="block space-y-2">
              <span className="auth-label">Recipient Name</span>
              <input
                value={recipientName}
                onChange={(event) => {
                  setRecipientName(event.target.value);
                  setSendError(null);
                }}
                placeholder="Anna Lee"
                className="paper-input"
              />
            </label>
          </div>
        )}

        <label className="block space-y-2">
          <span className="auth-label">Sender Display Name</span>
          <input
            value={senderDisplayName}
            onChange={(event) => setSenderDisplayName(event.target.value)}
            className="paper-input"
          />
        </label>

        <label className="block space-y-2">
          <span className="auth-label">Letter Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="paper-input"
          />
        </label>

        {sendError ? <p className="text-sm text-[var(--color-danger)]">{sendError}</p> : null}
      </div>

      <div className="parchment-dialog-actions">
        <button type="button" onClick={onClose} className="secondary-button">
          Keep Writing
        </button>
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sendDisabled}
          className="paper-button"
        >
          {isSending ? "Sending..." : "Seal and Send"}
        </button>
      </div>
    </ParchmentDialog>
  );
}
