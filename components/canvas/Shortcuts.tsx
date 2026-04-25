"use client";

import { useEffect } from "react";
import { useStore } from "@/state/store";

export function Shortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (e.key === "Escape") {
        e.preventDefault();
        const { pendingOp, applyState, selection, cancelOp, clearSelection, dismissApplyState } =
          useStore.getState();
        if (applyState.phase !== "idle" && applyState.phase !== "running") {
          dismissApplyState();
        } else if (pendingOp) {
          cancelOp();
        } else if (selection) {
          clearSelection();
        }
      }

      if (isInputFocused) return;

      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        useStore.getState().undoGraph();
      }

      // D: Toggle presenter mode with P key
      if (e.key === "p" || e.key === "P") {
        useStore.getState().togglePresenterMode();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
