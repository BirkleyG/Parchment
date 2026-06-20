"use client";

import { ParchmentDialog } from "@/components/ParchmentDialog";

type ConfirmBurnModalProps = {
  open: boolean;
  title?: string;
  body?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmBurnModal({
  open,
  title = "Burn Letter",
  body = "This will burn the letter permanently. It cannot be recovered.",
  confirmLabel = "Burn Letter",
  onClose,
  onConfirm,
}: ConfirmBurnModalProps) {
  return (
    <ParchmentDialog open={open} onClose={onClose} contentClassName="parchment-dialog-panel-sm">
      <h2 className="parchment-dialog-title">{title}</h2>
      <p className="parchment-dialog-copy">{body}</p>
      <div className="parchment-dialog-actions">
        <button type="button" onClick={onClose} className="secondary-button">
          Keep Letter
        </button>
        <button
          type="button"
          onClick={() => void onConfirm()}
          className="danger-button"
        >
          {confirmLabel}
        </button>
      </div>
    </ParchmentDialog>
  );
}
