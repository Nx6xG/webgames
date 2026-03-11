export type AvatarFrame =
  | 'none'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'fire'
  | 'diamond'
  | 'obsidian';

export interface FrameDef {
  id: AvatarFrame;
  /** Static Tailwind classes (ring/shadow) used as reduced-motion fallback */
  staticClass: string;
  /** CSS class for the animated wrapper (applied to .wg-frame-* in globals.css) */
  animClass: string;
  labelKey: string;
  /** Emoji shown in the frame picker tile */
  emoji: string;
}

export const FRAME_DEFS: FrameDef[] = [
  { id: 'none',     staticClass: '',                                                                  animClass: '',                  labelKey: 'frame.none',     emoji: '⊘' },
  { id: 'bronze',   staticClass: 'ring-2 ring-amber-600',                                             animClass: 'wg-frame-bronze',   labelKey: 'frame.bronze',   emoji: '◆' },
  { id: 'silver',   staticClass: 'ring-2 ring-gray-300',                                              animClass: 'wg-frame-silver',   labelKey: 'frame.silver',   emoji: '◈' },
  { id: 'gold',     staticClass: 'ring-2 ring-yellow-400',                                            animClass: 'wg-frame-gold',     labelKey: 'frame.gold',     emoji: '✦' },
  { id: 'fire',     staticClass: 'ring-2 ring-orange-500 shadow-[0_0_10px_rgba(255,120,0,0.6)]',      animClass: 'wg-frame-fire',     labelKey: 'frame.fire',     emoji: '🔥' },
  { id: 'diamond',  staticClass: 'ring-2 ring-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.5)]',      animClass: 'wg-frame-diamond',  labelKey: 'frame.diamond',  emoji: '💎' },
  { id: 'obsidian', staticClass: 'ring-2 ring-purple-800 shadow-[0_0_10px_rgba(107,33,168,0.5)]',     animClass: 'wg-frame-obsidian', labelKey: 'frame.obsidian', emoji: '🖤' },
];

const frameMap = new Map(FRAME_DEFS.map((f) => [f.id, f]));

export function getFrameDef(id?: string): FrameDef | undefined {
  if (!id || id === 'none') return undefined;
  return frameMap.get(id as AvatarFrame);
}

/** Returns the static Tailwind ring class (used as fallback / non-animated). */
export function getFrameClass(id?: string): string {
  if (!id || id === 'none') return '';
  return frameMap.get(id as AvatarFrame)?.staticClass ?? '';
}

/** Returns the CSS animation class name for the frame wrapper. */
export function getFrameAnimClass(id?: string): string {
  if (!id || id === 'none') return '';
  return frameMap.get(id as AvatarFrame)?.animClass ?? '';
}

// ── localStorage ───────────────────────────────────────────────────────────

export const FRAME_KEY = 'wg_avatar_frame';

export function getStoredFrame(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem(FRAME_KEY) || undefined;
}

export function setStoredFrame(frame: string | undefined): void {
  if (typeof window === 'undefined') return;
  if (frame && frame !== 'none') localStorage.setItem(FRAME_KEY, frame);
  else localStorage.removeItem(FRAME_KEY);
}
