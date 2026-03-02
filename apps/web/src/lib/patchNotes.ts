/**
 * Centralized helpers for the patch-notes "seen" tracking.
 * Import these in both PatchNotesDialog and PatchNotesFloatingButton
 * so the localStorage key and version comparison live in exactly one place.
 */
import { PATCH_NOTES_VERSION } from '@/content/patch-notes';

export const STORAGE_KEY = 'patchNotes:lastSeenVersion';

/** Returns true when the user has NOT yet seen the current version. Safe to call client-side only. */
export function isPatchNotesNew(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== PATCH_NOTES_VERSION;
  } catch {
    // localStorage unavailable (private browsing, SSR guard)
    return false;
  }
}

/** Writes the current version to localStorage, clearing the "new" state. */
export function markPatchNotesSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, PATCH_NOTES_VERSION);
  } catch {
    // ignore
  }
}
