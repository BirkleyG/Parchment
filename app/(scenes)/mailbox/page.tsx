"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ConfirmBurnModal } from "@/components/ConfirmBurnModal";
import { ParchmentDialog } from "@/components/ParchmentDialog";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  MAX_MAIL_BINS,
  canDeleteBin,
  createBin,
  deleteBin,
  listBins,
  renameBin,
} from "@/lib/binService";
import { formatLetterArrival } from "@/lib/dateUtils";
import { burnReceivedLetter, listMailboxLetters, moveLetterToBin, openLetter } from "@/lib/letterService";
import type { Letter, MailBin } from "@/lib/types";

function letterPages(letter: Letter | null): string[] {
  if (!letter) {
    return [""];
  }

  return Array.isArray(letter.pages) && letter.pages.length > 0 ? letter.pages : [letter.body ?? ""];
}

function selectedBinName(selectedBinId: string, bins: MailBin[]) {
  if (selectedBinId === "all") {
    return "All Letters";
  }

  return bins.find((bin) => bin.id === selectedBinId)?.name ?? "Selected Bin";
}

export default function MailboxPage() {
  const { profile } = useAuth();
  const [letters, setLetters] = useState<Letter[]>([]);
  const [bins, setBins] = useState<MailBin[]>([]);
  const [selectedBinId, setSelectedBinId] = useState("all");
  const [selectedLetterId, setSelectedLetterId] = useState<string | null>(null);
  const [targetMoveBinId, setTargetMoveBinId] = useState("");
  const [newBinName, setNewBinName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [burnModalOpen, setBurnModalOpen] = useState(false);
  const [readModalOpen, setReadModalOpen] = useState(false);
  const [readPageIndex, setReadPageIndex] = useState(0);

  const refreshMailbox = useCallback(async () => {
    if (!profile) {
      return;
    }

    const [nextLetters, nextBins] = await Promise.all([
      listMailboxLetters(profile.uid),
      listBins(profile.uid),
    ]);

    setLetters(nextLetters);
    setBins(nextBins);
    setTargetMoveBinId((current) => current || nextBins[0]?.id || "");
  }, [profile]);

  useEffect(() => {
    void refreshMailbox();
  }, [refreshMailbox]);

  useEffect(() => {
    if (!statusMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => setStatusMessage(null), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [statusMessage]);

  const unopenedCount = letters.filter((letter) => letter.status === "delivered").length;

  const binCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const letter of letters) {
      const key = letter.binId ?? "unopened";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [letters]);

  const displayedLetters = useMemo(() => {
    if (selectedBinId === "all") {
      return letters;
    }

    if (selectedBinId === "unopened") {
      return letters.filter((letter) => !letter.binId || letter.binId === "unopened");
    }

    return letters.filter((letter) => letter.binId === selectedBinId);
  }, [letters, selectedBinId]);

  useEffect(() => {
    if (displayedLetters.length === 0) {
      setSelectedLetterId(null);
      return;
    }

    const currentStillVisible = displayedLetters.some((letter) => letter.id === selectedLetterId);
    if (!currentStillVisible) {
      setSelectedLetterId(displayedLetters[0].id);
    }
  }, [displayedLetters, selectedLetterId]);

  const selectedLetter = displayedLetters.find((letter) => letter.id === selectedLetterId) ?? null;
  const selectedLetterPages = letterPages(selectedLetter);
  const selectedLetterIndex = selectedLetter ? displayedLetters.findIndex((letter) => letter.id === selectedLetter.id) : -1;
  const selectedBinLabel = selectedBinName(selectedBinId, bins);
  const canCreateMoreBins = bins.length < MAX_MAIL_BINS;

  useEffect(() => {
    setReadPageIndex((current) => Math.min(current, Math.max(0, selectedLetterPages.length - 1)));
  }, [selectedLetterPages.length]);

  async function handleOpenLetter() {
    if (!selectedLetter) {
      return;
    }

    if (selectedLetter.status !== "opened") {
      await openLetter(selectedLetter.id);
      await refreshMailbox();
      setStatusMessage("Letter opened.");
    }

    setReadPageIndex(0);
    setReadModalOpen(true);
  }

  async function handleMoveToBin(nextBinId = targetMoveBinId, successMessage = "Letter moved.") {
    if (!selectedLetter || !nextBinId) {
      return;
    }

    await moveLetterToBin(selectedLetter.id, nextBinId);
    await refreshMailbox();
    setStatusMessage(successMessage);
  }

  async function handleCreateBin() {
    if (!profile || !newBinName.trim()) {
      return;
    }

    try {
      await createBin(profile.uid, newBinName);
      setNewBinName("");
      await refreshMailbox();
      setStatusMessage("Bin created.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to create bin.");
    }
  }

  async function handleRenameBin() {
    if (!profile || selectedBinId === "all" || !renameValue.trim()) {
      return;
    }

    try {
      await renameBin(profile.uid, selectedBinId, renameValue);
      setRenameValue("");
      await refreshMailbox();
      setStatusMessage("Bin renamed.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to rename bin.");
    }
  }

  async function handleDeleteBin() {
    if (!profile || selectedBinId === "all") {
      return;
    }

    try {
      await deleteBin(profile.uid, selectedBinId, letters);
      setSelectedBinId("all");
      await refreshMailbox();
      setStatusMessage("Bin removed.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to delete bin.");
    }
  }

  async function handleBurnLetter() {
    if (!selectedLetter) {
      return;
    }

    await burnReceivedLetter(selectedLetter.id);
    setBurnModalOpen(false);
    setReadModalOpen(false);
    await refreshMailbox();
    setStatusMessage("Letter burned.");
  }

  return (
    <>
      <section className="desk-workspace mailbox-workspace">
        <div className="desk-ornament-divider mailbox-nav-divider" aria-hidden="true">
          <span className="desk-ornament-mark" />
        </div>

        <div className="mailbox-page-grid">
          <aside className="mailbox-left-rail">
            <div className="mailbox-left-stack">
              <section className="mailbox-left-intro">
                <div className="flex items-start justify-between gap-3">
                  <div className="mailbox-left-heading-block">
                    <p className="desk-rail-title">Mailbox</p>
                    <h2 className="mailbox-left-heading">Folders</h2>
                    <p className="mailbox-left-copy">
                      Sort and keep the letters that matter most.
                    </p>
                  </div>
                  <Image
                    src="/design-assets/Leaf 8.png"
                    alt=""
                    width={90}
                    height={132}
                    className="desk-rail-leaf mailbox-left-botanical"
                  />
                </div>

                <div className="mailbox-count-pills">
                  <span className="mailbox-count-pill">{letters.length} Total Letters</span>
                  <span className="mailbox-count-pill">{unopenedCount} Unopened</span>
                </div>
              </section>

              <div className="mailbox-bin-list">
                <button
                  type="button"
                  onClick={() => setSelectedBinId("all")}
                  className={`mailbox-bin-card ${selectedBinId === "all" ? "mailbox-bin-card-active" : ""}`}
                >
                  <div>
                    <p className="mailbox-bin-title">All Letters</p>
                    <p className="mailbox-bin-meta">{letters.length} letters total</p>
                  </div>
                  <div className="text-right">
                    <p className="mailbox-bin-meta">{unopenedCount} unopened</p>
                    <span className="mailbox-bin-dot" />
                  </div>
                </button>

                {bins.map((bin) => (
                  <button
                    key={bin.id}
                    type="button"
                    onClick={() => setSelectedBinId(bin.id)}
                    className={`mailbox-bin-card ${selectedBinId === bin.id ? "mailbox-bin-card-active" : ""}`}
                  >
                    <div>
                      <p className="mailbox-bin-title">{bin.name}</p>
                      <p className="mailbox-bin-meta">
                        {binCounts.get(bin.id) ?? 0} letter{(binCounts.get(bin.id) ?? 0) === 1 ? "" : "s"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <section className="mailbox-bin-creator">
                {selectedBinId === "all" ? (
                  <>
                    <p className="desk-field-label">New Bin</p>
                    <div className="mailbox-bin-create-row">
                      <input
                        value={newBinName}
                        onChange={(event) => setNewBinName(event.target.value)}
                        className="paper-input mailbox-bin-input"
                        placeholder={canCreateMoreBins ? "Name your bin..." : "Bin limit reached"}
                        disabled={!canCreateMoreBins}
                      />
                      <button
                        type="button"
                        className="paper-button mailbox-add-button"
                        onClick={() => void handleCreateBin()}
                        disabled={!canCreateMoreBins}
                      >
                        Add
                      </button>
                    </div>
                    <p className="mailbox-bin-limit">
                      {bins.length} of {MAX_MAIL_BINS} bins used
                    </p>
                  </>
                ) : (
                  <>
                    <p className="desk-field-label">Selected Bin</p>
                    <div className="mailbox-bin-manage">
                      <input
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        className="paper-input mailbox-bin-input"
                        placeholder="Rename selected bin"
                      />
                      <div className="flex gap-2">
                        <button type="button" className="secondary-button mailbox-manage-button" onClick={() => void handleRenameBin()}>
                          Rename
                        </button>
                        <button
                          type="button"
                          className="danger-button mailbox-manage-button"
                          disabled={!canDeleteBin(selectedBinId, letters)}
                          onClick={() => void handleDeleteBin()}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </div>

            <section className="desk-left-quote mailbox-left-quote">
              <Image
                src="/design-assets/Flower Stamp 3.png"
                alt=""
                width={72}
                height={140}
                className="desk-left-quote-floral"
              />
              <p className="font-fountain text-[1.15rem] leading-tight text-[var(--color-text-soft)]">
                Every letter is a
              </p>
              <p className="mt-1 font-fountain text-[1.15rem] leading-tight text-[var(--color-text-soft)]">
                moment worth keeping.
              </p>
              <p className="mt-1 font-fountain text-[1rem] leading-tight text-[var(--color-text-soft)]">-P.</p>
            </section>
          </aside>

          <section className="mailbox-center-panel">
            <div className="mailbox-center-card">
              <div className="mailbox-center-header">
                <div className="mailbox-center-title-block">
                  <h2 className="mailbox-center-heading">Mailbox</h2>
                  <p className="mailbox-center-copy">
                    Read, sort, and preserve the letters that have arrived.
                  </p>
                </div>
                <p className="mailbox-letter-count">
                  {displayedLetters.length} letter{displayedLetters.length === 1 ? "" : "s"}
                </p>
              </div>

              {statusMessage ? <p className="mailbox-status-message">{statusMessage}</p> : null}

              {selectedLetter ? (
                <>
                  <div className="mailbox-envelope-stage">
                    {displayedLetters.length > 1 ? (
                      <>
                        <div className="mailbox-envelope-back mailbox-envelope-back-one" aria-hidden="true" />
                        <div className="mailbox-envelope-back mailbox-envelope-back-two" aria-hidden="true" />
                        <div className="mailbox-envelope-back mailbox-envelope-back-three" aria-hidden="true" />
                      </>
                    ) : null}

                    <article className="mailbox-envelope">
                      <div className="mailbox-envelope-overlay">
                        <div className="mailbox-envelope-address mailbox-envelope-address-to">
                          <p className="mailbox-envelope-label">To</p>
                          <p>{profile?.settings.firstName} {profile?.settings.lastName}</p>
                          <p>@{profile?.settings.mailboxName}</p>
                          <p>Parchment Registry</p>
                        </div>

                        <div className="mailbox-envelope-title-block">
                          <p className="mailbox-envelope-title">{selectedLetter.title.trim() || "Untitled Letter"}</p>
                          <div className="desk-ornament-divider mailbox-envelope-divider" aria-hidden="true">
                            <span className="desk-ornament-mark" />
                          </div>
                        </div>

                        <div className="mailbox-envelope-address mailbox-envelope-address-from">
                          <p className="mailbox-envelope-label">From</p>
                          <p>{selectedLetter.fromName || "Unknown sender"}</p>
                          <p>@{selectedLetter.fromMailboxName || "unknown"}</p>
                          <p>{selectedLetter.toName ? "Parchment Post" : "Awaiting Registry"}</p>
                        </div>

                        <div className="mailbox-envelope-status">
                          <p>{selectedLetter.deliveredAt ? "Delivered" : "Arrived"}</p>
                          <p className="mailbox-envelope-status-line">
                            <span className="mailbox-status-dot" />
                            {selectedLetter.status === "opened" ? "Opened" : "Unopened"}
                          </p>
                        </div>

                        <Image
                          src="/design-assets/Stamp.png"
                          alt=""
                          width={170}
                          height={120}
                          className="mailbox-envelope-postmark"
                        />
                        <Image
                          src="/design-assets/Leaf 6.png"
                          alt=""
                          width={120}
                          height={120}
                          className="mailbox-envelope-sprig"
                        />
                      </div>

                      <div className="mailbox-envelope-seal" aria-hidden="true">
                        <Image src="/design-assets/Seal.png" alt="" width={122} height={122} className="mailbox-envelope-seal-image" />
                      </div>
                    </article>
                  </div>

                  <div className="mailbox-stack-controls">
                    <button
                      type="button"
                      className="mailbox-stack-arrow"
                      onClick={() => setSelectedLetterId(displayedLetters[Math.max(0, selectedLetterIndex - 1)]?.id ?? selectedLetter.id)}
                      disabled={selectedLetterIndex <= 0}
                    >
                      {"<"}
                    </button>
                    <p className="mailbox-stack-position">
                      {selectedLetterIndex + 1} of {displayedLetters.length}
                    </p>
                    <button
                      type="button"
                      className="mailbox-stack-arrow"
                      onClick={() => setSelectedLetterId(displayedLetters[Math.min(displayedLetters.length - 1, selectedLetterIndex + 1)]?.id ?? selectedLetter.id)}
                      disabled={selectedLetterIndex >= displayedLetters.length - 1}
                    >
                      {">"}
                    </button>
                  </div>

                  <div className="mailbox-meta-footer">
                    <div className="mailbox-meta-item">
                      <Image src="/design-assets/Letter with Clock.png" alt="" width={24} height={24} className="mailbox-meta-icon" />
                      <div>
                        <p className="mailbox-meta-title">Delivered</p>
                        <p className="mailbox-meta-copy">Status: {selectedLetter.status === "opened" ? "Opened" : "Unopened"}</p>
                      </div>
                    </div>
                    <div className="mailbox-meta-item">
                      <Image src="/design-assets/Open Book.png" alt="" width={24} height={24} className="mailbox-meta-icon" />
                      <div>
                        <p className="mailbox-meta-title">Arrived</p>
                        <p className="mailbox-meta-copy">{formatLetterArrival(selectedLetter.deliveredAt ?? selectedLetter.createdAt)}</p>
                      </div>
                    </div>
                    <div className="mailbox-meta-item">
                      <Image src="/design-assets/Letter Drawr.png" alt="" width={24} height={24} className="mailbox-meta-icon" />
                      <div>
                        <p className="mailbox-meta-title">Current Bin</p>
                        <p className="mailbox-meta-copy">{selectedBinLabel}</p>
                      </div>
                    </div>
                    <div className="mailbox-meta-item">
                      <Image src="/design-assets/Parchment Stamp.png" alt="" width={24} height={24} className="mailbox-meta-icon" />
                      <div>
                        <p className="mailbox-meta-title">From</p>
                        <p className="mailbox-meta-copy">{selectedLetter.fromName || "Unknown sender"}</p>
                      </div>
                    </div>
                    <div className="mailbox-meta-item">
                      <Image src="/design-assets/Registry.png" alt="" width={24} height={24} className="mailbox-meta-icon" />
                      <div>
                        <p className="mailbox-meta-title">To</p>
                        <p className="mailbox-meta-copy">{profile?.settings.firstName} {profile?.settings.lastName}</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="mailbox-empty-state">
                  <Image src="/design-assets/Letter.png" alt="" width={92} height={92} className="h-20 w-20 object-contain opacity-80" />
                  <h2 className="mt-5 font-display text-5xl text-[var(--color-text-strong)]">No letters here yet</h2>
                  <p className="mt-4 max-w-xl text-[1rem] leading-8 text-[var(--color-text-soft)]">
                    This folder is quiet for now. When a letter arrives, it will rest here waiting to be opened.
                  </p>
                </div>
              )}
            </div>
          </section>

          <aside className="desk-card mailbox-right-panel">
            <section>
              <h3 className="desk-panel-heading">Actions</h3>
              <div className="desk-ornament-divider desk-ornament-divider-compact" aria-hidden="true">
                <span className="desk-ornament-mark" />
              </div>

              <div className="desk-action-stack">
                <button
                  type="button"
                  onClick={() => void handleOpenLetter()}
                  className="desk-action-button"
                  disabled={!selectedLetter}
                >
                  <Image src="/design-assets/Letter.png" alt="" width={50} height={50} className="desk-action-icon" />
                  <div>
                    <p className="desk-action-title">Open Letter</p>
                    <p className="desk-action-copy">Read its contents</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => void handleMoveToBin()}
                  className="desk-action-button"
                  disabled={!selectedLetter || !targetMoveBinId}
                >
                  <Image src="/design-assets/Letter Drawr.png" alt="" width={50} height={50} className="desk-action-icon" />
                  <div>
                    <p className="desk-action-title">Move to Bin</p>
                    <p className="desk-action-copy">Organize this letter</p>
                  </div>
                </button>

                <select
                  value={targetMoveBinId}
                  onChange={(event) => setTargetMoveBinId(event.target.value)}
                  className="paper-select mailbox-move-select"
                >
                  {bins.map((bin) => (
                    <option key={bin.id} value={bin.id}>
                      {bin.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setBurnModalOpen(true)}
                  className="desk-action-button desk-action-button-danger"
                  disabled={!selectedLetter}
                >
                  <Image src="/design-assets/Burn Letter.png" alt="" width={50} height={50} className="desk-action-icon" />
                  <div>
                    <p className="desk-action-title">Burn Letter</p>
                    <p className="desk-action-copy">Remove permanently</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => void handleMoveToBin("unopened", "Letter returned to the pile.")}
                  className="desk-action-button"
                  disabled={!selectedLetter}
                >
                  <Image src="/design-assets/Complex Feather.png" alt="" width={50} height={50} className="desk-action-icon" />
                  <div>
                    <p className="desk-action-title">Return to Pile</p>
                    <p className="desk-action-copy">Move back to unopened</p>
                  </div>
                </button>
              </div>
            </section>

            <section className="desk-panel-section">
              <div className="desk-panel-label">Letter Details</div>
              <div className="desk-summary-card mailbox-details-card">
                <Image
                  src="/design-assets/Leaf 8.png"
                  alt=""
                  width={90}
                  height={120}
                  className="desk-summary-sprig"
                />
                <div className="desk-summary-grid">
                  <span>From</span>
                  <span className="text-[var(--color-text-strong)]">{selectedLetter?.fromName || "Unknown sender"}</span>
                  <span>To</span>
                  <span className="text-[var(--color-text-strong)]">{profile?.settings.firstName} {profile?.settings.lastName}</span>
                  <span>Title</span>
                  <span className="text-[var(--color-text-strong)]">{selectedLetter?.title || "Untitled Letter"}</span>
                  <span>Arrival Date</span>
                  <span className="text-[var(--color-text-strong)]">
                    {selectedLetter ? formatLetterArrival(selectedLetter.deliveredAt ?? selectedLetter.createdAt) : "-"}
                  </span>
                  <span>Current Bin</span>
                  <span className="text-[var(--color-text-strong)]">{selectedBinLabel}</span>
                  <span>Status</span>
                  <span className="text-[var(--color-text-strong)]">{selectedLetter?.status === "opened" ? "Opened" : "Unopened"}</span>
                  <span>Delivery</span>
                  <span className="flex items-center gap-2 text-[var(--color-text-strong)]">
                    <Image src="/design-assets/Lock.png" alt="" width={16} height={16} className="h-4 w-4 object-contain" />
                    Delivered
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
          </aside>
        </div>
      </section>

      <ParchmentDialog
        open={readModalOpen && Boolean(selectedLetter)}
        onClose={() => setReadModalOpen(false)}
        className="mailbox-read-overlay"
        contentClassName="mailbox-read-shell"
      >
        {selectedLetter ? (
          <>
            <button type="button" className="mailbox-read-close" onClick={() => setReadModalOpen(false)}>
              Close
            </button>

            <div className="paper-sheet mailbox-read-paper">
              <span className="paper-corner paper-corner-tl" />
              <span className="paper-corner paper-corner-tr" />
              <span className="paper-corner paper-corner-bl" />
              <span className="paper-corner paper-corner-br" />

              <div className="desk-paper-body mailbox-read-body">
                <Image
                  src="/design-assets/Stamp.png"
                  alt=""
                  width={200}
                  height={140}
                  className="desk-postmark"
                />
                <div className="mailbox-read-content">
                  <h2 className="mailbox-read-title">{selectedLetter.title.trim() || "Untitled Letter"}</h2>
                  <p className="mailbox-read-subtitle">
                    From {selectedLetter.fromName || "Unknown sender"} &middot; {formatLetterArrival(selectedLetter.deliveredAt ?? selectedLetter.createdAt)}
                  </p>
                  <div className="mailbox-read-text">
                    {selectedLetterPages[readPageIndex] || "This letter is empty."}
                  </div>
                </div>
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
                  <span>Read at your own pace</span>
                </div>
                <div className="desk-toolbar-item desk-toolbar-item-centered">
                  <button
                    type="button"
                    className="desk-page-nav-button"
                    onClick={() => setReadPageIndex((current) => Math.max(0, current - 1))}
                    disabled={readPageIndex === 0}
                  >
                    {"<"}
                  </button>
                  <select
                    value={readPageIndex}
                    onChange={(event) => setReadPageIndex(Number(event.target.value))}
                    className="desk-page-select"
                  >
                    {selectedLetterPages.map((_, index) => (
                      <option key={`${selectedLetter.id}-read-page-${index + 1}`} value={index}>
                        {`Page ${index + 1} of ${selectedLetterPages.length}`}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="desk-page-nav-button"
                    onClick={() => setReadPageIndex((current) => Math.min(selectedLetterPages.length - 1, current + 1))}
                    disabled={readPageIndex >= selectedLetterPages.length - 1}
                  >
                    {">"}
                  </button>
                </div>
                <div className="desk-toolbar-item desk-toolbar-item-end">
                  <Image src="/design-assets/Parchment Stamp 2.png" alt="" width={18} height={18} className="h-4 w-4 object-contain" />
                  <span>{selectedBinLabel}</span>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </ParchmentDialog>

      <ConfirmBurnModal
        open={burnModalOpen}
        title="Burn This Letter?"
        body="This permanently removes the selected letter from your mailbox."
        confirmLabel="Burn Letter"
        onClose={() => setBurnModalOpen(false)}
        onConfirm={handleBurnLetter}
      />
    </>
  );
}
