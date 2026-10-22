'use client';
import { useEffect, useRef, type RefObject } from 'react';

/** Shares the existing overlay; no nested modal is introduced for the pass. */
export function useDialogFocus(open: boolean, dialog: RefObject<HTMLElement | null>, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; }, [close]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => dialog.current?.focus({ preventScroll: true }));
    const keydown = (e: KeyboardEvent) => {
      const el = dialog.current;
      if (!el) return;
      const activeDialog = (document.activeElement as HTMLElement | null)?.closest('[role="dialog"]');
      if (activeDialog && activeDialog !== el) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current(); }
      if (e.key !== 'Tab') return;
      const items = Array.from(el.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'))
        .filter(item => item.getClientRects().length && getComputedStyle(item).visibility !== 'hidden');
      const first = items[0], last = items[items.length - 1];
      if (!first) { e.preventDefault(); el.focus(); return; }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el || !el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown, true);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', keydown, true); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [open, dialog]);
}
