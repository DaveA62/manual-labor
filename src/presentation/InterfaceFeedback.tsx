import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getPlatform } from "../platform";
import type { FeedbackKind } from "../platform/contracts";
/** UI-only event delegation includes native dialogs and plain navigation buttons. */
export function InterfaceFeedback({ sound }: { sound: boolean }) {
  const serial = useRef(0);
  const [pulses, setPulses] = useState<{ id: number; x: number; y: number }[]>(
    [],
  );
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const button = (event.target as Element).closest<HTMLElement>(
        'button,[role="button"]',
      );
      if (
        !button ||
        button.matches(':disabled,[aria-disabled="true"]') ||
        button.closest(".machine-control,.retirement-film")
      )
        return;
      const kind = (button.dataset.feedback ??
        (button.closest(".primary-nav,.pager") ||
        button.classList.contains("machine-open")
          ? "switch"
          : "ui")) as FeedbackKind;
      if (button.dataset.feedback !== "none")
        getPlatform().feedback(kind, sound);
      if (!event.detail || button.closest("dialog,.continuum")) return;
      const r = button.getBoundingClientRect();
      setPulses((old) => [
        ...old.slice(-5),
        {
          id: ++serial.current,
          x: Math.max(r.left, Math.min(r.right, event.clientX)),
          y: Math.max(r.top, Math.min(r.bottom, event.clientY)),
        },
      ]);
    };
    const hover = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const el = (event.target as Element).closest("button");
      if (
        el &&
        !el.matches(":disabled") &&
        !el.contains(event.relatedTarget as Node | null)
      )
        getPlatform().feedback("hover", sound);
    };
    document.addEventListener("click", click);
    document.addEventListener("pointerover", hover);
    return () => {
      document.removeEventListener("click", click);
      document.removeEventListener("pointerover", hover);
    };
  }, [sound]);
  useEffect(() => {
    if (!pulses.length) return;
    const id = setTimeout(() => setPulses([]), 500);
    return () => clearTimeout(id);
  }, [pulses]);
  return createPortal(
    <div className="interface-feedback" aria-hidden="true">
      {pulses.map((p) => (
        <i key={p.id} style={{ left: p.x, top: p.y }} />
      ))}
    </div>,
    document.body,
  );
}
