"use client";

import { useEffect, useState } from "react";

import { ParchmentDialog } from "@/components/ParchmentDialog";

type NewLetterModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string) => Promise<void>;
};

export function NewLetterModal({ open, onClose, onCreate }: NewLetterModalProps) {
  const [title, setTitle] = useState("");
  const [isCreating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
    }
  }, [open]);

  async function handleCreate() {
    setCreating(true);
    try {
      await onCreate(title.trim());
      onClose();
    } catch {
      // Keep modal open when create is rejected by desk rules (for example, draft cap).
    } finally {
      setCreating(false);
    }
  }

  return (
    <ParchmentDialog open={open} onClose={onClose} contentClassName="parchment-dialog-panel-md">
      <p className="parchment-dialog-title">Begin a New Letter</p>
      <label className="block space-y-2">
        <span className="auth-label">Letter Title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="paper-input"
          placeholder="Untitled Letter"
        />
      </label>

      <div className="parchment-dialog-actions">
        <button type="button" onClick={onClose} className="secondary-button">
          Keep Desk As-Is
        </button>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={isCreating}
          className="paper-button"
        >
          {isCreating ? "Preparing..." : "Create Letter"}
        </button>
      </div>
    </ParchmentDialog>
  );
}
