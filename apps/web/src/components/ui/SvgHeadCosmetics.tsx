'use client';

/**
 * SVG head cosmetics that integrate with avatars instead of floating emoji stickers.
 * Each cosmetic is designed to sit naturally on top of the avatar bubble.
 */

import { useId } from 'react';

interface HeadCosmeticProps {
  className?: string;
}

function useGIds() {
  const raw = useId();
  const uid = raw.replace(/:/g, '');
  return (suffix: string) => `hc${uid}${suffix}`;
}

// ── Crown — royal crown with gems and curved base ──
function CrownCosmetic({ className }: HeadCosmeticProps) {
  const g = useGIds();
  return (
    <svg className={className} viewBox="0 0 40 24" fill="none">
      <defs>
        <linearGradient id={g('gold')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="30%" stopColor="#fbbf24" />
          <stop offset="70%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id={g('inner')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
        <radialGradient id={g('gem')} cx="40%" cy="35%" r="50%">
          <stop offset="0%" stopColor="#fca5a5" />
          <stop offset="50%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </radialGradient>
        <radialGradient id={g('gem2')} cx="40%" cy="35%" r="50%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </radialGradient>
      </defs>
      {/* Crown base — curved to fit round avatar */}
      <path d="M5 20 Q20 23 35 20 L35 17 Q20 20 5 17Z" fill={`url(#${g('inner')})`} />
      {/* Crown body — 5 pointed peaks */}
      <path d="M5 17 L3 6 L10 12 L15 3 L20 10 L25 3 L30 12 L37 6 L35 17 Q20 20 5 17Z" fill={`url(#${g('gold')})`} />
      {/* Crown body highlight — left side */}
      <path d="M5 17 L3 6 L10 12 L15 3 L12 10 L5 14Z" fill="white" fillOpacity="0.1" />
      {/* Crown body shadow — right side */}
      <path d="M35 17 L37 6 L30 12 L25 3 L28 10 L35 14Z" fill="black" fillOpacity="0.12" />
      {/* Crown base band — decorative */}
      <path d="M6 17 Q20 19.5 34 17 Q20 19 6 17Z" fill="#92400e" />
      <path d="M6.5 16.5 Q20 19 33.5 16.5" stroke="#fde68a" strokeWidth="0.4" strokeOpacity="0.3" fill="none" />
      {/* Peak tips — gold balls */}
      <circle cx="3" cy="5.5" r="1.2" fill="#fbbf24" />
      <circle cx="15" cy="2.5" r="1.2" fill="#fbbf24" />
      <circle cx="20" cy="9.5" r="1" fill="#fbbf24" />
      <circle cx="25" cy="2.5" r="1.2" fill="#fbbf24" />
      <circle cx="37" cy="5.5" r="1.2" fill="#fbbf24" />
      {/* Peak tip highlights */}
      <circle cx="2.5" cy="5" r="0.4" fill="white" fillOpacity="0.4" />
      <circle cx="14.5" cy="2" r="0.4" fill="white" fillOpacity="0.4" />
      <circle cx="24.5" cy="2" r="0.4" fill="white" fillOpacity="0.4" />
      {/* Center gem — large red */}
      <circle cx="20" cy="15" r="2" fill={`url(#${g('gem')})`} />
      <circle cx="19.3" cy="14.3" r="0.6" fill="white" fillOpacity="0.4" />
      {/* Side gems — blue */}
      <circle cx="12" cy="15.5" r="1.3" fill={`url(#${g('gem2')})`} />
      <circle cx="11.5" cy="15" r="0.4" fill="white" fillOpacity="0.3" />
      <circle cx="28" cy="15.5" r="1.3" fill={`url(#${g('gem2')})`} />
      <circle cx="27.5" cy="15" r="0.4" fill="white" fillOpacity="0.3" />
      {/* Bottom shadow on avatar */}
      <ellipse cx="20" cy="21.5" rx="14" ry="1.5" fill="black" fillOpacity="0.15" />
    </svg>
  );
}

// ── Cap — baseball cap with curved brim and stitching ──
function CapCosmetic({ className }: HeadCosmeticProps) {
  const g = useGIds();
  return (
    <svg className={className} viewBox="0 0 40 22" fill="none">
      <defs>
        <linearGradient id={g('cap')} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id={g('brim')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
      {/* Cap dome — curved to fit head */}
      <path d="M8 18 Q8 6 20 4 Q32 6 32 18 Q20 20 8 18Z" fill={`url(#${g('cap')})`} />
      {/* Cap dome highlight */}
      <path d="M12 8 Q20 4 28 8 Q24 5 20 5 Q16 5 12 8Z" fill="white" fillOpacity="0.12" />
      {/* Left shine */}
      <path d="M8 18 Q8 6 20 4 L12 8 L8 15Z" fill="white" fillOpacity="0.06" />
      {/* Button on top */}
      <circle cx="20" cy="5" r="1.3" fill="#1d4ed8" stroke="#3b82f6" strokeWidth="0.4" />
      {/* Stitching — curved panel line */}
      <path d="M20 5 Q20 10 20 18" stroke="#1e40af" strokeWidth="0.4" strokeDasharray="1.5 1" strokeOpacity="0.5" />
      {/* Brim — extends forward, curved with perspective */}
      <path d="M4 17 Q8 14 20 13 Q32 14 36 17 Q34 20 20 21 Q6 20 4 17Z" fill={`url(#${g('brim')})`} />
      {/* Brim top edge highlight */}
      <path d="M5 17 Q20 13.5 35 17" stroke="#60a5fa" strokeWidth="0.4" strokeOpacity="0.3" fill="none" />
      {/* Brim underside shadow */}
      <path d="M6 18 Q20 20 34 18 Q20 21 6 18Z" fill="black" fillOpacity="0.2" />
      {/* Shadow on avatar */}
      <ellipse cx="20" cy="20" rx="14" ry="1.5" fill="black" fillOpacity="0.12" />
    </svg>
  );
}

// ── Wizard Hat — tall pointed hat with magical glow ──
function WizardHatCosmetic({ className }: HeadCosmeticProps) {
  const g = useGIds();
  return (
    <svg className={className} viewBox="0 0 40 32" fill="none">
      <defs>
        <linearGradient id={g('hat')} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#6d28d9" />
          <stop offset="40%" stopColor="#4c1d95" />
          <stop offset="100%" stopColor="#2e1065" />
        </linearGradient>
        <radialGradient id={g('star')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id={g('glow')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.5" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      {/* Tip glow */}
      <circle cx="16" cy="4" r="4" fill={`url(#${g('glow')})`} />
      {/* Hat body — tall cone, slightly curved */}
      <path d="M16 2 Q14 10 10 20 Q8 24 6 28 Q20 30 34 28 Q32 24 30 20 Q26 10 24 2Z" fill={`url(#${g('hat')})`} />
      {/* Left highlight */}
      <path d="M16 2 Q14 10 10 20 L12 18 L18 4Z" fill="white" fillOpacity="0.06" />
      {/* Right shadow */}
      <path d="M24 2 Q26 10 30 20 L28 18 L22 4Z" fill="black" fillOpacity="0.15" />
      {/* Hat band */}
      <path d="M8 25 Q20 27 32 25 Q20 28 8 25Z" fill="#7c3aed" />
      <path d="M8.5 25 Q20 27 31.5 25" stroke="#a78bfa" strokeWidth="0.3" strokeOpacity="0.3" fill="none" />
      {/* Brim — wide curved base */}
      <path d="M2 27 Q20 23 38 27 Q36 31 20 32 Q4 31 2 27Z" fill={`url(#${g('hat')})`} />
      {/* Brim highlight */}
      <path d="M4 27.5 Q20 24 36 27.5" stroke="#7c3aed" strokeWidth="0.4" strokeOpacity="0.3" fill="none" />
      {/* Brim underside */}
      <path d="M4 28 Q20 31 36 28 Q20 32 4 28Z" fill="black" fillOpacity="0.2" />
      {/* Star emblem on hat band */}
      <path d="M20 23 L21 25 L23.5 25 L21.5 26.5 L22.5 29 L20 27.5 L17.5 29 L18.5 26.5 L16.5 25 L19 25Z" fill={`url(#${g('star')})`} />
      <circle cx="19.5" cy="25.5" r="0.4" fill="white" fillOpacity="0.4" />
      {/* Tip star */}
      <circle cx="16" cy="2.5" r="1.2" fill="#fbbf24" fillOpacity="0.7" />
      <circle cx="16" cy="2.5" r="0.5" fill="white" fillOpacity="0.6" />
      {/* Floating sparkles */}
      <circle cx="10" cy="8" r="0.5" fill="#e9d5ff" fillOpacity="0.4" />
      <circle cx="28" cy="12" r="0.4" fill="#c4b5fd" fillOpacity="0.3" />
      <circle cx="13" cy="16" r="0.35" fill="#ddd6fe" fillOpacity="0.3" />
    </svg>
  );
}

// ── Top Hat — tall cylindrical hat with ribbon band ──
function TopHatCosmetic({ className }: HeadCosmeticProps) {
  const g = useGIds();
  return (
    <svg className={className} viewBox="0 0 40 30" fill="none">
      <defs>
        <linearGradient id={g('hat')} x1="0.25" y1="0" x2="0.75" y2="1">
          <stop offset="0%" stopColor="#3f3f46" />
          <stop offset="40%" stopColor="#27272a" />
          <stop offset="100%" stopColor="#18181b" />
        </linearGradient>
        <linearGradient id={g('band')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7f1d1d" />
          <stop offset="50%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>
      </defs>
      {/* Hat crown — tall cylinder with slight taper */}
      <path d="M12 24 L12 6 Q12 3 20 2 Q28 3 28 6 L28 24Z" fill={`url(#${g('hat')})`} />
      {/* Crown top — ellipse for 3D */}
      <ellipse cx="20" cy="4" rx="8.5" ry="2.5" fill="#3f3f46" />
      <ellipse cx="20" cy="4" rx="8" ry="2" fill="#27272a" />
      {/* Top highlight */}
      <ellipse cx="18" cy="3.5" rx="4" ry="1" fill="white" fillOpacity="0.06" />
      {/* Left side highlight */}
      <path d="M12 6 L12 24 L14 24 L14 6 Q14 5 16 4Z" fill="white" fillOpacity="0.05" />
      {/* Right shadow */}
      <path d="M28 6 L28 24 L26 24 L26 6 Q26 5 24 4Z" fill="black" fillOpacity="0.15" />
      {/* Ribbon band */}
      <rect x="11.5" y="19" width="17" height="3" rx="0.5" fill={`url(#${g('band')})`} />
      <path d="M12 19.5 L28 19.5" stroke="white" strokeWidth="0.3" strokeOpacity="0.1" />
      {/* Ribbon buckle */}
      <rect x="18" y="18.5" width="4" height="4" rx="0.5" fill="#fbbf24" stroke="#d97706" strokeWidth="0.4" />
      <rect x="19" y="19.3" width="2" height="2.4" rx="0.3" fill="#92400e" />
      {/* Brim — wide elliptical */}
      <ellipse cx="20" cy="25" rx="16" ry="3.5" fill={`url(#${g('hat')})`} />
      {/* Brim top edge */}
      <ellipse cx="20" cy="24.5" rx="15.5" ry="3" fill="none" stroke="#52525b" strokeWidth="0.4" />
      {/* Brim highlight */}
      <path d="M8 24 Q20 22 32 24" stroke="white" strokeWidth="0.3" strokeOpacity="0.06" fill="none" />
      {/* Brim underside shadow */}
      <ellipse cx="20" cy="26" rx="14" ry="2" fill="black" fillOpacity="0.2" />
      {/* Shadow on avatar */}
      <ellipse cx="20" cy="27.5" rx="12" ry="1.5" fill="black" fillOpacity="0.1" />
    </svg>
  );
}

// ── Registry ──

const HEAD_SVG_MAP: Record<string, React.ComponentType<HeadCosmeticProps>> = {
  crown: CrownCosmetic,
  cap: CapCosmetic,
  wizard_hat: WizardHatCosmetic,
  top_hat: TopHatCosmetic,
};

export function hasHeadSvg(headId: string): boolean {
  return headId in HEAD_SVG_MAP;
}

export function SvgHeadCosmetic({ headId, className }: { headId: string; className?: string }) {
  const Component = HEAD_SVG_MAP[headId];
  if (!Component) return null;
  return <Component className={className} />;
}
