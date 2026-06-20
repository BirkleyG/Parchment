"use client";

import { useEffect } from "react";

export function AutoFullscreen() {
  useEffect(() => {
    let lastAttemptAt = 0;
    let requestPending = false;

    const attemptFullscreen = () => {
      if (typeof document === "undefined") {
        return;
      }

      if (document.fullscreenElement || !document.fullscreenEnabled) {
        return;
      }

      const target = document.documentElement;
      if (!target.requestFullscreen) {
        return;
      }

      const now = Date.now();
      if (requestPending || now - lastAttemptAt < 600) {
        return;
      }

      lastAttemptAt = now;
      requestPending = true;
      void target.requestFullscreen().catch(() => {
        // Ignore: browsers may deny fullscreen without a user gesture.
      }).finally(() => {
        requestPending = false;
      });
    };

    const handleTrigger = () => {
      attemptFullscreen();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        attemptFullscreen();
      }
    };

    attemptFullscreen();

    window.addEventListener("pointerdown", handleTrigger, true);
    window.addEventListener("keydown", handleTrigger, true);
    window.addEventListener("touchstart", handleTrigger, true);
    window.addEventListener("focus", handleTrigger);
    window.addEventListener("pageshow", handleTrigger);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("fullscreenchange", handleTrigger);

    return () => {
      window.removeEventListener("pointerdown", handleTrigger, true);
      window.removeEventListener("keydown", handleTrigger, true);
      window.removeEventListener("touchstart", handleTrigger, true);
      window.removeEventListener("focus", handleTrigger);
      window.removeEventListener("pageshow", handleTrigger);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("fullscreenchange", handleTrigger);
    };
  }, []);

  return null;
}
