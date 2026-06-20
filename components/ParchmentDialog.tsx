"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

type ParchmentDialogProps = {
  open: boolean;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  onClose?: () => void;
};

export function ParchmentDialog({
  open,
  children,
  className = "",
  contentClassName = "",
  onClose,
}: ParchmentDialogProps) {
  useEffect(() => {
    if (!open || !onClose) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={`parchment-dialog-overlay ${className}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onClose?.();
            }
          }}
        >
          <motion.div
            initial={{ y: 18, opacity: 0, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`parchment-dialog-panel ${contentClassName}`}
            role="dialog"
            aria-modal="true"
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
