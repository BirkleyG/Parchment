"use client";

import Image from "next/image";
import { addDays, format } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ConfirmBurnModal } from "@/components/ConfirmBurnModal";
import { NewLetterModal } from "@/components/NewLetterModal";
import { ParchmentDialog } from "@/components/ParchmentDialog";
import { SendLetterModal } from "@/components/SendLetterModal";
import { useAuth } from "@/components/providers/AuthProvider";
import { buildInviteMessage, buildInviteUrl, sendInviteDraft } from "@/lib/inviteService";
import { createDraft, burnDraft, listDrafts, saveDraft, sendDraft } from "@/lib/letterService";
import { findUserByMailbox } from "@/lib/registryService";
import { getLastDraftId, setLastDraftId } from "@/lib/storage";
import type { Letter, SendDraftPayload } from "@/lib/types";

const AUTOSAVE_DELAY_MS = 800;

function normalizeDraft(letter: Letter): Letter {
  const pages = Array.isArray(letter.pages) && letter.pages.length > 0 ? letter.pages : [letter.body ?? ""];
  return {
    ...letter,
    pages,
    body: pages.join("\n\n").trim(),
    writingMode: "typewriter",
  };
}

function senderDisplayName(letter: Letter | null, username?: string): string {
  const trimmed = letter?.fromName?.trim();
  return trimmed || username || "";
}

function formatDateTime(value?: string) {
  if (!value) {
    return "Not yet edited";
  }

  return format(new Date(value), "MMMM d, yyyy 'at' h:mm a");
}

function draftDeliveryText(delayDays: number) {
  const now = new Date();
  const end = addDays(now, delayDays);
  return `${format(now, "MMMM d")} - ${format(end, "MMMM d, yyyy")}`;
}

export default function DeskPage() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const [drafts, setDrafts] = useState<Letter[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [isAutosaveDirty, setAutosaveDirty] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendModalRecipient, setSendModalRecipient] = useState("");
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [inviteConfirmation, setInviteConfirmation] = useState<{
    inviteLink: string;
    recipientName: string;
    clipboardStatus: string | null;
  } | null>(null);
  const [burnModalOpen, setBurnModalOpen] = useState(false);
  const [newLetterModalOpen, setNewLetterModalOpen] = useState(false);
  const [pendingComposeTo, setPendingComposeTo] = useState<string | null>(null);
  const [pageOverflowState, setPageOverflowState] = useState<{
    pageIndex: number;
    fittedText: string;
    overflowText: string;
  } | null>(null);
  const letterTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const measureTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mobileLetterTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mobileMeasureTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const handledComposeParamRef = useRef<string | null>(null);
  const handledOpenNewParamRef = useRef<string | null>(null);

  const activeDraft = useMemo(
    () => drafts.find((entry) => entry.id === activeDraftId) ?? null,
    [activeDraftId, drafts],
  );

  const refreshDrafts = useCallback(async () => {
    if (!profile) {
      return;
    }

    setLoading(true);
    const fetchedDrafts = (await listDrafts(profile.uid)).map(normalizeDraft);
    setDrafts(fetchedDrafts);

    if (fetchedDrafts.length === 0) {
      setActiveDraftId(null);
      setLoading(false);
      return;
    }

    const lastDraftId = getLastDraftId();
    const nextActive = fetchedDrafts.find((entry) => entry.id === lastDraftId) ?? fetchedDrafts[0];
    setActiveDraftId(nextActive.id);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    void refreshDrafts();
  }, [refreshDrafts]);

  useEffect(() => {
    setActivePageIndex(0);
  }, [activeDraftId]);

  useEffect(() => {
    setActivePageIndex((current) => {
      const maxIndex = Math.max(0, (activeDraft?.pages?.length ?? 1) - 1);
      return Math.min(current, maxIndex);
    });
  }, [activeDraft?.pages]);

  useEffect(() => {
    if (pendingComposeTo && activeDraft) {
      setSendModalRecipient(pendingComposeTo);
      setSendModalOpen(true);
      setPendingComposeTo(null);
    }
  }, [activeDraft, pendingComposeTo]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (!activeDraft || !isAutosaveDirty) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      const savedDraft = normalizeDraft(await saveDraft(activeDraft));
      setDrafts((current) => current.map((entry) => (entry.id === savedDraft.id ? savedDraft : entry)));
      setAutosaveDirty(false);
      setNotice("Autosaved just now");
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeDraft, isAutosaveDirty]);

  function selectDraft(draftId: string) {
    setActiveDraftId(draftId);
    setLastDraftId(draftId);
  }

  function patchDraft(patch: Partial<Letter>) {
    if (!activeDraft) {
      return;
    }

    setDrafts((current) =>
      current.map((entry) =>
        entry.id === activeDraft.id
          ? normalizeDraft({
              ...entry,
              ...patch,
            })
          : entry,
      ),
    );
    setAutosaveDirty(true);
  }

  function patchDraftPages(nextPages: string[]) {
    patchDraft({
      pages: nextPages,
      body: nextPages.join("\n\n").trim(),
    });
  }

  async function handleCreateDraft(title: string) {
    if (!profile) {
      return;
    }

    const created = normalizeDraft(await createDraft(profile));
    const prepared = title ? normalizeDraft(await saveDraft({ ...created, title })) : created;

    setDrafts((current) => [prepared, ...current]);
    selectDraft(prepared.id);
    setNotice("New draft ready");
  }

  useEffect(() => {
    if (!profile || loading) {
      return;
    }

    const composeTo = searchParams.get("composeTo")?.trim().replace(/^@/, "").toLowerCase() ?? "";
    const openNew = searchParams.get("openNew") === "1";

    if (composeTo && handledComposeParamRef.current !== composeTo) {
      handledComposeParamRef.current = composeTo;

      if (activeDraft) {
        setSendModalRecipient(composeTo);
        setSendModalOpen(true);
      } else {
        setPendingComposeTo(composeTo);
        void handleCreateDraft("");
      }
    }

    const openNewKey = openNew ? searchParams.toString() : null;
    if (openNew && openNewKey && handledOpenNewParamRef.current !== openNewKey) {
      handledOpenNewParamRef.current = openNewKey;
      setNewLetterModalOpen(true);
    }
  }, [activeDraft, handleCreateDraft, loading, profile, searchParams]);

  async function handleSend(payload: SendDraftPayload) {
    if (!profile || !activeDraft) {
      return;
    }

    if (payload.kind === "registry") {
      await sendDraft(profile, activeDraft, payload);
    } else {
      const { invite } = await sendInviteDraft(profile, activeDraft, payload);
      const inviteLink = buildInviteUrl(window.location.origin, invite.id);
      const clipboardText = buildInviteMessage(inviteLink);
      let clipboardStatus = "Invitation copied to your clipboard.";

      try {
        await navigator.clipboard.writeText(clipboardText);
      } catch {
        clipboardStatus = "Copy the message below before you send it along.";
      }

      setInviteConfirmation({
        inviteLink,
        recipientName: payload.recipientName.trim(),
        clipboardStatus,
      });
    }

    const remainingDrafts = drafts.filter((entry) => entry.id !== activeDraft.id);
    setDrafts(remainingDrafts);
    const nextDraft = remainingDrafts[0] ?? null;
    setActiveDraftId(nextDraft?.id ?? null);
    if (nextDraft) {
      setLastDraftId(nextDraft.id);
    }
    setNotice(payload.kind === "registry" ? "Letter sent" : "Invitation prepared");
  }

  async function handleCopyInviteLink() {
    if (!inviteConfirmation) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteConfirmation.inviteLink);
      setInviteConfirmation((current) => current ? { ...current, clipboardStatus: "Invitation link copied." } : current);
    } catch {
      setInviteConfirmation((current) => current ? { ...current, clipboardStatus: "Unable to copy automatically. The link is still available below." } : current);
    }
  }

  async function handleCopyInviteMessage() {
    if (!inviteConfirmation) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildInviteMessage(inviteConfirmation.inviteLink));
      setInviteConfirmation((current) => current ? { ...current, clipboardStatus: "Invitation message copied." } : current);
    } catch {
      setInviteConfirmation((current) => current ? { ...current, clipboardStatus: "Unable to copy automatically. You can still share the link below." } : current);
    }
  }

  async function handleBurnDraft() {
    if (!activeDraft) {
      return;
    }

    await burnDraft(activeDraft.id);
    setBurnModalOpen(false);
    const remainingDrafts = drafts.filter((entry) => entry.id !== activeDraft.id);
    setDrafts(remainingDrafts);
    const nextDraft = remainingDrafts[0] ?? null;
    setActiveDraftId(nextDraft?.id ?? null);
    if (nextDraft) {
      setLastDraftId(nextDraft.id);
    }
    setNotice("Draft removed");
  }

  function getFittedText(
    text: string,
    textarea = letterTextareaRef.current,
    measure = measureTextareaRef.current,
  ) {

    if (!textarea || !measure) {
      return text;
    }

    measure.style.width = `${textarea.clientWidth}px`;
    measure.style.height = `${textarea.clientHeight}px`;
    measure.value = text;

    if (measure.scrollHeight <= measure.clientHeight) {
      return text;
    }

    let low = 0;
    let high = text.length;
    let best = "";

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = text.slice(0, mid);
      measure.value = candidate;

      if (measure.scrollHeight <= measure.clientHeight) {
        best = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return best;
  }

  function handlePageChange(
    nextValue: string,
    textarea = letterTextareaRef.current,
    measure = measureTextareaRef.current,
  ) {
    if (!activeDraft) {
      return;
    }

    const currentPages = [...(activeDraft.pages ?? [activeDraft.body ?? ""])];
    const fittedText = getFittedText(nextValue, textarea, measure);

    if (fittedText === nextValue) {
      currentPages[activePageIndex] = nextValue;
      patchDraftPages(currentPages);
      return;
    }

    currentPages[activePageIndex] = fittedText;
    patchDraftPages(currentPages);

    const overflowText = nextValue.slice(fittedText.length);
    if (overflowText.length > 0) {
      setPageOverflowState({
        pageIndex: activePageIndex,
        fittedText,
        overflowText,
      });
    }
  }

  function handleCreateNextPage() {
    if (!activeDraft || !pageOverflowState) {
      return;
    }

    const currentPages = [...(activeDraft.pages ?? [activeDraft.body ?? ""])];
    currentPages[pageOverflowState.pageIndex] = pageOverflowState.fittedText;
    currentPages.splice(pageOverflowState.pageIndex + 1, 0, pageOverflowState.overflowText.replace(/^\n+/, ""));
    patchDraftPages(currentPages);
    setActivePageIndex(pageOverflowState.pageIndex + 1);
    setPageOverflowState(null);
    setNotice("New page added");
  }

  function handleDismissOverflow() {
    setPageOverflowState(null);
    setNotice("Page is full");
  }

  if (loading) {
    return (
      <section className="page-surface p-8">
        <p className="eyebrow">Desk</p>
        <p className="mt-4 text-[var(--color-text-soft)]">Loading drafts...</p>
      </section>
    );
  }

  const pages = activeDraft?.pages ?? [activeDraft?.body ?? ""];
  const activePageValue = pages[activePageIndex] ?? "";
  const pageCount = pages.length;
  const senderName = senderDisplayName(activeDraft, profile?.username);
  const deliveryWindow = draftDeliveryText(profile?.settings.outgoingDelayDays ?? 1);
  return (
    <>
      <section className="desk-workspace">
        <div className="desk-ornament-divider" aria-hidden="true">
          <span className="desk-ornament-mark" />
        </div>

        <section className="scene-mobile-only desk-mobile-shell">
          <div className="mobile-scene-card">
            <div className="mobile-scene-heading-row">
              <div>
                <p className="mobile-scene-eyebrow">Desk</p>
                <h2 className="mobile-scene-title">Write</h2>
              </div>
              <button
                type="button"
                className="paper-button mobile-scene-button"
                onClick={() => setNewLetterModalOpen(true)}
              >
                New
              </button>
            </div>

            <div className="mobile-desk-controls">
              <label className="mobile-scene-field">
                <span>Draft</span>
                {drafts.length > 0 ? (
                  <select
                    value={activeDraftId ?? ""}
                    onChange={(event) => selectDraft(event.target.value)}
                    className="paper-select"
                  >
                    {drafts.map((draft) => (
                      <option key={draft.id} value={draft.id}>
                        {draft.title.trim() || "Untitled Letter"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="mobile-scene-empty">No drafts yet</div>
                )}
              </label>

              {activeDraft ? (
                <label className="mobile-scene-field">
                  <span>Title</span>
                  <input
                    value={activeDraft.title ?? ""}
                    onChange={(event) => patchDraft({ title: event.target.value })}
                    className="paper-input"
                    placeholder="Rename this draft"
                    aria-label="Draft title"
                  />
                </label>
              ) : null}
            </div>
          </div>

          <div className="mobile-scene-card mobile-desk-preview">
            {activeDraft ? (
              <>
                <p className="mobile-scene-eyebrow">Current Draft</p>
                <h3 className="mobile-preview-title">{activeDraft.title.trim() || "Untitled Letter"}</h3>
                <p className="mobile-preview-copy">
                  Page {activePageIndex + 1} of {pageCount}
                </p>
                <p className="mobile-preview-copy">{notice ?? (isAutosaveDirty ? "Saving..." : "Autosaved just now")}</p>
                <div className="mobile-action-row mobile-action-row-compact">
                  <button type="button" className="secondary-button" onClick={() => setBurnModalOpen(true)}>
                    Burn
                  </button>
                  <button type="button" className="secondary-button" onClick={() => setMobileEditorOpen(true)}>
                    Write / Edit
                  </button>
                  <button type="button" className="paper-button" onClick={() => setSendModalOpen(true)}>
                    Send
                  </button>
                </div>
              </>
            ) : (
              <div className="paper-sheet flex h-full min-h-[420px] flex-col items-center justify-center px-8 text-center">
                <Image src="/design-assets/Letter.png" alt="" width={84} height={84} className="h-20 w-20 object-contain opacity-85" />
                <h2 className="mt-6 font-display text-5xl text-[var(--color-text-strong)]">
                  Ready for a new letter
                </h2>
                <button
                  type="button"
                  className="paper-button mt-8"
                  onClick={() => setNewLetterModalOpen(true)}
                >
                  Create Your First Draft
                </button>
              </div>
            )}
          </div>
        </section>

        <div className="desk-page-grid scene-desktop-only">
          <aside className="desk-left-rail">
            <div className="desk-left-stack">
              <section className="desk-left-intro">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="desk-rail-title">Desk</h2>
                    <div className="desk-rail-divider" aria-hidden="true" />
                    <p className="desk-rail-copy">
                      Your writing space. Create, save, and prepare letters for the perfect moment.
                    </p>
                  </div>
                  <Image
                    src="/design-assets/Leaf 8.png"
                    alt=""
                    width={72}
                    height={110}
                    className="desk-rail-leaf"
                  />
                </div>
              </section>

              <section className="desk-status-card">
                <div className="flex items-center gap-3">
                  <Image src="/design-assets/Parchment Stamp.png" alt="" width={34} height={34} className="h-9 w-9 object-contain" />
                  <div>
                    <p className="desk-status-title">Status</p>
                    <p className="desk-status-copy">
                      {drafts.length} draft{drafts.length === 1 ? "" : "s"} in progress
                    </p>
                  </div>
                </div>
                <div className="mt-3.5">
                  <p className="desk-field-label">Active Draft</p>
                  {drafts.length > 0 ? (
                    <>
                      <select
                        value={activeDraftId ?? ""}
                        onChange={(event) => selectDraft(event.target.value)}
                        className="paper-select desk-draft-select"
                      >
                        {drafts.map((draft) => (
                          <option key={draft.id} value={draft.id}>
                            {draft.title.trim() || "Untitled Letter"}
                          </option>
                        ))}
                      </select>
                      <input
                        value={activeDraft?.title ?? ""}
                        onChange={(event) => patchDraft({ title: event.target.value })}
                        className="desk-draft-title-input"
                        placeholder="Rename this draft"
                        aria-label="Draft title"
                      />
                    </>
                  ) : (
                    <div className="desk-empty-copy">No drafts yet</div>
                  )}
                </div>
              </section>
            </div>

            <section className="desk-left-quote">
              <Image
                src="/design-assets/Flower Stamp 2.png"
                alt=""
                width={72}
                height={140}
                className="desk-left-quote-floral"
              />
              <p className="font-fountain text-[1.25rem] leading-tight text-[var(--color-text-soft)]">
                Write with care.
              </p>
              <p className="mt-1.5 font-fountain text-[1.25rem] leading-tight text-[var(--color-text-soft)]">
                Let time do the rest.
              </p>
              <div className="desk-quote-divider" aria-hidden="true" />
            </section>
          </aside>

          <section className="desk-card desk-center-card">
            {activeDraft ? (
              <div className="paper-sheet desk-paper">
                <span className="paper-corner paper-corner-tl" />
                <span className="paper-corner paper-corner-tr" />
                <span className="paper-corner paper-corner-bl" />
                <span className="paper-corner paper-corner-br" />

                <div className="desk-paper-body">
                  <Image
                    src="/design-assets/Stamp.png"
                    alt=""
                    width={200}
                    height={140}
                    className="desk-postmark"
                  />

                  <textarea
                    ref={letterTextareaRef}
                    value={activePageValue}
                    onChange={(event) => handlePageChange(event.target.value)}
                    className="letter-textarea desk-letter-textarea"
                    placeholder={"Dear friend,\n\nI hope this letter finds you well. I have been working for quite some time on writing out the words here, and I have never been truly able to find what I was hoping to say with mere words.\n\nBut hopefully this does justice to what I am imagining this could be. Hopefully I can write with the elegance and wisdom of one with knowledge, and the kindness of a friend.\n\nHopefully these words do not sting, but rather encourage. Hopefully they bring tidings of great joy, rather than sorrow. For it is joy that I search for.\n\nWith care,\nP."}
                    spellCheck={false}
                  />
                  <textarea
                    ref={measureTextareaRef}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="letter-textarea desk-letter-textarea desk-measure-textarea"
                    readOnly
                  />

                  <Image
                    src="/design-assets/Leaf 6.png"
                    alt=""
                    width={170}
                    height={170}
                    className="desk-paper-sprig"
                  />
                </div>

                <div className="desk-paper-toolbar">
                  <div className="desk-toolbar-item">
                    <Image src="/design-assets/Simple Feather.png" alt="" width={18} height={18} className="h-4 w-4 object-contain" />
                    <span>{notice ?? (isAutosaveDirty ? "Saving..." : "Autosaved just now")}</span>
                  </div>
                  <div className="desk-toolbar-item desk-toolbar-item-centered">
                    <button
                      type="button"
                      className="desk-page-nav-button"
                      onClick={() => setActivePageIndex((current) => Math.max(0, current - 1))}
                      disabled={activePageIndex === 0}
                      aria-label="Previous page"
                    >
                      {"<"}
                    </button>
                    <select
                      value={activePageIndex}
                      onChange={(event) => setActivePageIndex(Number(event.target.value))}
                      className="desk-page-select"
                      aria-label="Selected page"
                    >
                      {pages.map((_, index) => (
                        <option key={`${activeDraft?.id ?? "draft"}-page-${index + 1}`} value={index}>
                          {`Page ${index + 1} of ${pageCount}`}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="desk-page-nav-button"
                      onClick={() => setActivePageIndex((current) => Math.min(pageCount - 1, current + 1))}
                      disabled={activePageIndex >= pageCount - 1}
                      aria-label="Next page"
                    >
                      {">"}
                    </button>
                  </div>
                  <div className="desk-toolbar-item desk-toolbar-item-end">
                    <Image src="/design-assets/Parchment Stamp 2.png" alt="" width={18} height={18} className="h-4 w-4 object-contain" />
                    <span>Last edited {formatDateTime(activeDraft.updatedAt ?? activeDraft.createdAt)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="paper-sheet flex h-full min-h-[560px] flex-col items-center justify-center px-8 text-center">
                <Image src="/design-assets/Letter.png" alt="" width={84} height={84} className="h-20 w-20 object-contain opacity-85" />
                <h2 className="mt-6 font-display text-5xl text-[var(--color-text-strong)]">
                  Ready for a new letter
                </h2>
                <p className="mt-4 max-w-xl text-[1.08rem] leading-8 text-[var(--color-text-soft)]">
                  Start a fresh draft and this desk will shape itself around your words.
                </p>
                <button
                  type="button"
                  className="paper-button mt-8"
                  onClick={() => setNewLetterModalOpen(true)}
                >
                  Create Your First Draft
                </button>
              </div>
            )}
          </section>

          <aside className="desk-card desk-right-panel">
            <section>
              <h3 className="desk-panel-heading">Actions</h3>
              <div className="desk-ornament-divider desk-ornament-divider-compact" aria-hidden="true">
                <span className="desk-ornament-mark" />
              </div>

              <div className="desk-action-stack">
                <button
                  type="button"
                  onClick={() => setNewLetterModalOpen(true)}
                  className="desk-action-button"
                >
                  <Image src="/design-assets/Add Page.png" alt="" width={50} height={50} className="desk-action-icon" />
                  <div>
                    <p className="desk-action-title">Start a Letter</p>
                    <p className="desk-action-copy">Continue your letter</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSendModalOpen(true)}
                  className="desk-action-button desk-action-button-primary"
                >
                  <Image src="/design-assets/Letter.png" alt="" width={54} height={54} className="desk-action-icon desk-action-icon-envelope" />
                  <div>
                    <p className="desk-action-title">Seal &amp; Send</p>
                    <p className="desk-action-copy">Prepare for delivery</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBurnModalOpen(true)}
                  className="desk-action-button desk-action-button-danger"
                >
                  <Image src="/design-assets/Burn Letter.png" alt="" width={50} height={50} className="desk-action-icon" />
                  <div>
                    <p className="desk-action-title">Burn</p>
                    <p className="desk-action-copy">Remove this draft</p>
                  </div>
                </button>
              </div>
            </section>

            <section className="desk-panel-section">
              <div className="desk-panel-label">Letter Summary</div>
              <div className="desk-summary-card">
                <Image
                  src="/design-assets/Leaf 8.png"
                  alt=""
                  width={90}
                  height={120}
                  className="desk-summary-sprig"
                />
                <div className="desk-summary-grid">
                  <span>To</span>
                  <span className="text-[var(--color-text-strong)]">{activeDraft?.toName || "Not addressed yet"}</span>
                  <span>From</span>
                  <span className="text-[var(--color-text-strong)]">{senderName}</span>
                  <span>Delivery</span>
                  <span className="text-[var(--color-text-strong)]">{deliveryWindow}</span>
                  <span>Privacy</span>
                  <span className="flex items-center gap-2 text-[var(--color-text-strong)]">
                    <Image src="/design-assets/Lock.png" alt="" width={16} height={16} className="h-4 w-4 object-contain" />
                    Encrypted &amp; private
                  </span>
                </div>
              </div>
            </section>

            <section className="desk-guidance-card">
              <Image src="/design-assets/Ticket with Flower.png" alt="" width={44} height={44} className="h-10 w-10 object-contain" />
              <div>
                <p className="desk-panel-label mb-1">Writing Guidance</p>
                <p className="text-[0.78rem] leading-5 text-[var(--color-text-soft)]">
                  Take your time. Meaningful letters are rarely written in a rush.
                </p>
              </div>
            </section>

            <section className="desk-right-quote">
              <Image
                src="/design-assets/Leaf 5.png"
                alt=""
                width={74}
                height={74}
                className="desk-right-quote-leaf-left"
              />
              <Image
                src="/design-assets/Leaf 2.png"
                alt=""
                width={74}
                height={74}
                className="desk-right-quote-leaf-right"
              />
              <p className="font-fountain text-[1.22rem] leading-tight text-[var(--color-text-soft)]">
                Some things are better
              </p>
              <p className="font-fountain text-[1.22rem] leading-tight text-[var(--color-text-soft)]">
                when they take time.
              </p>
            </section>
          </aside>
        </div>
      </section>

      <NewLetterModal
        open={newLetterModalOpen}
        onClose={() => setNewLetterModalOpen(false)}
        onCreate={handleCreateDraft}
      />

      <SendLetterModal
        open={sendModalOpen}
        initialSenderName={senderName}
        initialTitle={activeDraft?.title ?? ""}
        initialRecipientMailboxName={sendModalRecipient}
        onLookup={findUserByMailbox}
        onClose={() => {
          setSendModalOpen(false);
          setSendModalRecipient("");
        }}
        onSend={handleSend}
      />

      <ConfirmBurnModal
        open={burnModalOpen}
        title="Burn This Draft?"
        body="This removes the draft permanently from your desk."
        confirmLabel="Burn Draft"
        onClose={() => setBurnModalOpen(false)}
        onConfirm={handleBurnDraft}
      />

      <ParchmentDialog
        open={mobileEditorOpen && Boolean(activeDraft)}
        onClose={() => setMobileEditorOpen(false)}
        className="mobile-page-dialog-overlay"
        contentClassName="mobile-page-dialog-shell"
      >
        {activeDraft ? (
          <>
            <div className="mobile-page-dialog-bar">
              <button type="button" className="secondary-button" onClick={() => setMobileEditorOpen(false)}>
                Done
              </button>
              <span className="mobile-page-dialog-meta">Page {activePageIndex + 1} of {pageCount}</span>
            </div>

            <div className="mobile-page-stage">
              <div className="mobile-page-scale-frame">
                <div className="paper-sheet desk-paper mobile-editor-paper">
                  <span className="paper-corner paper-corner-tl" />
                  <span className="paper-corner paper-corner-tr" />
                  <span className="paper-corner paper-corner-bl" />
                  <span className="paper-corner paper-corner-br" />

                  <div className="desk-paper-body mobile-editor-body">
                    <Image
                      src="/design-assets/Stamp.png"
                      alt=""
                      width={200}
                      height={140}
                      className="desk-postmark"
                    />

                    <textarea
                      ref={mobileLetterTextareaRef}
                      value={activePageValue}
                      onChange={(event) => handlePageChange(event.target.value, mobileLetterTextareaRef.current, mobileMeasureTextareaRef.current)}
                      className="letter-textarea desk-letter-textarea mobile-editor-textarea"
                      placeholder={"Dear friend,\n\nI hope this letter finds you well. I have been working for quite some time on writing out the words here, and I have never been truly able to find what I was hoping to say with mere words.\n\nBut hopefully this does justice to what I am imagining this could be. Hopefully I can write with the elegance and wisdom of one with knowledge, and the kindness of a friend.\n\nHopefully these words do not sting, but rather encourage. Hopefully they bring tidings of great joy, rather than sorrow. For it is joy that I search for.\n\nWith care,\nP."}
                      spellCheck={false}
                    />
                    <textarea
                      ref={mobileMeasureTextareaRef}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="letter-textarea desk-letter-textarea desk-measure-textarea mobile-editor-textarea"
                      readOnly
                    />

                    <Image
                      src="/design-assets/Leaf 6.png"
                      alt=""
                      width={170}
                      height={170}
                      className="desk-paper-sprig"
                    />
                  </div>

                  <div className="desk-paper-toolbar mobile-editor-toolbar">
                    <div className="desk-toolbar-item">
                      <Image src="/design-assets/Simple Feather.png" alt="" width={18} height={18} className="h-4 w-4 object-contain" />
                      <span>{notice ?? (isAutosaveDirty ? "Saving..." : "Autosaved just now")}</span>
                    </div>
                    <div className="desk-toolbar-item desk-toolbar-item-centered">
                      <button
                        type="button"
                        className="desk-page-nav-button"
                        onClick={() => setActivePageIndex((current) => Math.max(0, current - 1))}
                        disabled={activePageIndex === 0}
                        aria-label="Previous page"
                      >
                        {"<"}
                      </button>
                      <select
                        value={activePageIndex}
                        onChange={(event) => setActivePageIndex(Number(event.target.value))}
                        className="desk-page-select"
                        aria-label="Selected page"
                      >
                        {pages.map((_, index) => (
                          <option key={`${activeDraft.id}-dialog-page-${index + 1}`} value={index}>
                            {`Page ${index + 1} of ${pageCount}`}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="desk-page-nav-button"
                        onClick={() => setActivePageIndex((current) => Math.min(pageCount - 1, current + 1))}
                        disabled={activePageIndex >= pageCount - 1}
                        aria-label="Next page"
                      >
                        {">"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </ParchmentDialog>

      <ParchmentDialog
        open={Boolean(pageOverflowState)}
        onClose={handleDismissOverflow}
        contentClassName="parchment-dialog-panel-sm"
      >
        <p className="parchment-dialog-title">This page is full.</p>
        <p className="parchment-dialog-copy">
          Would you like to add another page and continue this letter?
        </p>
        <div className="parchment-dialog-actions">
          <button type="button" className="secondary-button" onClick={handleDismissOverflow}>
            Keep one page
          </button>
          <button type="button" className="paper-button" onClick={handleCreateNextPage}>
            Add page
          </button>
        </div>
      </ParchmentDialog>

      <ParchmentDialog
        open={Boolean(inviteConfirmation)}
        onClose={() => setInviteConfirmation(null)}
        contentClassName="parchment-dialog-panel-md"
      >
        <p className="parchment-dialog-title">Invitation Ready</p>
        <p className="parchment-dialog-copy">
          Your letter for {inviteConfirmation?.recipientName || "your recipient"} is waiting behind a one-time invitation link.
        </p>
        {inviteConfirmation?.clipboardStatus ? (
          <p className="send-invite-feedback">{inviteConfirmation.clipboardStatus}</p>
        ) : null}
        <div className="send-invite-result-card">
          <span className="send-invite-result-label">Invitation Link</span>
          <p className="send-invite-result-link">{inviteConfirmation?.inviteLink}</p>
        </div>
        <div className="send-invite-result-actions">
          <button type="button" className="secondary-button" onClick={() => void handleCopyInviteLink()}>
            Copy Link
          </button>
          <button type="button" className="paper-button" onClick={() => void handleCopyInviteMessage()}>
            Copy Message
          </button>
        </div>
      </ParchmentDialog>
    </>
  );
}
