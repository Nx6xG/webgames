export type AvatarFrame =
  | 'none'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'fire';

export interface FrameDef {
  id: AvatarFrame;
  /** Static Tailwind classes (ring/shadow) used as reduced-motion fallback */
  staticClass: string;
  /** CSS class for the animated wrapper (applied to .wg-frame-* in globals.css) */
  animClass: string;
  labelKey: string;
  /** i18n key describing how to unlock */
  unlockHintKey: string;
  /** Emoji shown in the frame picker tile */
  emoji: string;
  requiredAchievement?: string;
}

export const FRAME_DEFS: FrameDef[] = [
  {
    id: 'none',
    staticClass: '',
    animClass: '',
    labelKey: 'frame.none',
    unlockHintKey: '',
    emoji: '⊘',
  },
  {
    id: 'bronze',
    staticClass: 'ring-2 ring-amber-600',
    animClass: 'wg-frame-bronze',
    labelKey: 'frame.bronze',
    unlockHintKey: 'frame.unlock.bronze',
    emoji: '◆',
    requiredAchievement: 'general.play_10',
  },
  {
    id: 'silver',
    staticClass: 'ring-2 ring-gray-300',
    animClass: 'wg-frame-silver',
    labelKey: 'frame.silver',
    unlockHintKey: 'frame.unlock.silver',
    emoji: '◈',
    requiredAchievement: 'general.win_10',
  },
  {
    id: 'gold',
    staticClass: 'ring-2 ring-yellow-400',
    animClass: 'wg-frame-gold',
    labelKey: 'frame.gold',
    unlockHintKey: 'frame.unlock.gold',
    emoji: '✦',
    requiredAchievement: 'chess.win_3',
  },
  {
    id: 'fire',
    staticClass: 'ring-2 ring-orange-500 shadow-[0_0_10px_rgba(255,120,0,0.6)]',
    animClass: 'wg-frame-fire',
    labelKey: 'frame.fire',
    unlockHintKey: 'frame.unlock.fire',
    emoji: '🔥',
    requiredAchievement: 'battleship.win_3',
  },
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
