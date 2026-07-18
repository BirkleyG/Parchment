"use client";

import { useEffect, useMemo, useState } from "react";

import { ParchmentDialog } from "@/components/ParchmentDialog";
import { buildInviteMessage, buildInviteUrl, getInviteStatuses, rotateInviteLink } from "@/lib/inviteService";
import { listSentLetters } from "@/lib/letterService";
import type { AuthProfile, InviteClaim, Letter } from "@/lib/types";

type SentLettersDialogProps = {
  open: boolean;
  profile: AuthProfile;
  onClose: () => void;
};

type SentStatus = "Unclaimed" | "Claimed" | "In-air" | "Delivered";

function sentStatus(letter: Letter, invite?: InviteClaim): SentStatus {
  if (letter.recipientMode === "invite" && letter.inviteStatus === "pending" && invite?.status !== "claimed") return "Unclaimed";
  if (letter.status === "inTransit") return "In-air";
  if (letter.status === "delivered" || letter.status === "opened") return "Delivered";
  return "Claimed";
}

function sentDate(letter: Letter) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(letter.sentAt ?? letter.createdAt),
  );
}

export function SentLettersDialog({ open, profile, onClose }: SentLettersDialogProps) {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [invites, setInvites] = useState<Record<string, InviteClaim>>({});
  const [selected, setSelected] = useState<Letter | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected(null);
    setInviteLink("");
    setFeedback(null);
    setError(null);
    void listSentLetters(profile.uid)
      .then(async (nextLetters) => {
        setLetters(nextLetters);
        setInvites(await getInviteStatuses(nextLetters.flatMap((letter) => letter.inviteId ? [letter.inviteId] : [])));
      })
      .catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : "Unable to load sent letters."))
      .finally(() => setLoading(false));
  }, [open, profile.uid]);

  const selectedStatus = useMemo(
    () => selected ? sentStatus(selected, selected.inviteId ? invites[selected.inviteId] : undefined) : null,
    [invites, selected],
  );

  async function handleNewLink() {
    if (!selected) return;
    setRotating(true);
    setError(null);
    setFeedback(null);
    try {
      const invite = await rotateInviteLink(profile, selected);
      const link = buildInviteUrl(window.location.origin, invite.id);
      setInviteLink(link);
      setInvites((current) => ({ ...current, [invite.id]: invite }));
      setLetters((current) => current.map((letter) => letter.id === selected.id ? { ...letter, inviteId: invite.id } : letter));
      setSelected((current) => current ? { ...current, inviteId: invite.id } : current);
      setFeedback("A fresh link is ready. The previous link no longer works.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to generate a new link.");
    } finally {
      setRotating(false);
    }
  }

  async function copy(text: string, success: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback(success);
      setError(null);
    } catch {
      setError("Unable to copy to your clipboard.");
    }
  }

  return (
    <ParchmentDialog open={open} onClose={onClose} contentClassName="parchment-dialog-panel-lg sent-letters-dialog">
      <div className="sent-letters-heading-row">
        <div>
          <p className="eyebrow">Correspondence ledger</p>
          <h2 className="parchment-dialog-title">Sent Letters</h2>
        </div>
        <button type="button" className="sent-letters-close" onClick={onClose} aria-label="Close sent letters">×</button>
      </div>

      {loading ? <p className="sent-letters-empty">Opening your ledger…</p> : null}
      {!loading && letters.length === 0 ? <p className="sent-letters-empty">You have not sent any letters yet.</p> : null}
      {error ? <p className="invite-error">{error}</p> : null}

      {!loading && letters.length > 0 ? (
        <div className="sent-letters-layout">
          <div className="sent-letters-list" aria-label="Sent letters">
            {letters.map((letter) => {
              const status = sentStatus(letter, letter.inviteId ? invites[letter.inviteId] : undefined);
              const canOpen = status === "Unclaimed";
              return (
                <button
                  key={letter.id}
                  type="button"
                  className={`sent-letter-row ${selected?.id === letter.id ? "sent-letter-row-active" : ""}`}
                  onClick={() => {
                    if (!canOpen) return;
                    setSelected(letter);
                    setInviteLink(letter.inviteId ? buildInviteUrl(window.location.origin, letter.inviteId) : "");
                    setFeedback(null);
                    setError(null);
                  }}
                  disabled={!canOpen}
                >
                  <span className="sent-letter-main"><strong>{letter.title || "Untitled Letter"}</strong><small>For {letter.toName || `@${letter.toMailboxName}`} · {sentDate(letter)}</small></span>
                  <span className={`sent-letter-status sent-letter-status-${status.toLowerCase().replace("-", "")}`}>{status}</span>
                </button>
              );
            })}
          </div>

          <aside className="sent-letter-detail">
            {selected && selectedStatus === "Unclaimed" ? (
              <>
                <span className="send-invite-result-label">Unclaimed invitation</span>
                <h3>{selected.title || "Untitled Letter"}</h3>
                <p>Generate a fresh link if you want to resend this letter. The old link will be retired.</p>
                {inviteLink ? <p className="send-invite-result-link">{inviteLink}</p> : null}
                {feedback ? <p className="send-invite-feedback">{feedback}</p> : null}
                <div className="send-invite-result-actions">
                  <button type="button" className="paper-button" disabled={rotating} onClick={() => void handleNewLink()}>
                    {rotating ? "Generating…" : "Generate New Link"}
                  </button>
                  {inviteLink ? <button type="button" className="secondary-button" onClick={() => void copy(inviteLink, "Link copied.")}>Copy Link</button> : null}
                  {inviteLink ? <button type="button" className="secondary-button" onClick={() => void copy(buildInviteMessage(inviteLink), "Message copied.")}>Copy Message</button> : null}
                </div>
              </>
            ) : <p className="sent-letters-empty">Select an unclaimed letter to prepare a new invitation link.</p>}
          </aside>
        </div>
      ) : null}
    </ParchmentDialog>
  );
}
