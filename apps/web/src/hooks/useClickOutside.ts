'use client';

import { type RefObject, useEffect, useRef } from 'react';

/**
 * Fires `handler` when a pointerdown event occurs outside all supplied refs.
 *
 * - Accepts a single ref OR an array of refs (e.g. trigger + panel living in
 *   separate DOM sub-trees).  The handler fires only when the event target is
 *   NOT contained by ANY of the provided refs.
 * - Uses the document capture phase so it fires before inner handlers and is
 *   immune to stopPropagation() calls on child elements.
 * - Stores the latest handler in a ref so the listener never needs to be
 *   re-added when the handler identity changes (avoids stale-closure issues).
 * - SSR-safe: document access is inside useEffect.
 * - Pass `enabled=false` while the element is closed to avoid unnecessary work.
 *
 * Important: every element that should count as "inside" must be covered by
 * one of the supplied refs (or be a DOM descendant of one).  Clicking any of
 * those elements will NOT trigger the handler.
 */
export function useClickOutside(
  ref: RefObject<Element | null> | RefObject<Element | null>[],
  handler: () => void,
  enabled = true,
): void {
  // Keep a stable ref to the latest handler — avoids re-adding the listener
  // on every render just because an inline function was recreated.
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;

    // Normalise to array so single-ref and multi-ref usage share one code path.
    const targets = Array.isArray(ref) ? ref : [ref];

    function onPointerDown(e: PointerEvent) {
      // Fire only when the target is outside ALL provided refs.
      const isInside = targets.some((r) => r.current?.contains(e.target as Node));
      if (!isInside) handlerRef.current();
    }

    document.addEventListener('pointerdown', onPointerDown, /* capture */ true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
    // Refs are stable (created once by useRef) — only re-subscribe on enabled toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

/**
 * Fires `handler` when the Escape key is pressed.
 *
 * - SSR-safe: window access is inside useEffect.
 * - Pass `enabled=false` while the element is closed.
 */
export function useEscape(handler: () => void, enabled = true): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handlerRef.current();
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
