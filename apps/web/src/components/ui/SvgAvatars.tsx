'use client';

/**
 * Game-style SVG avatar icons — transparent backgrounds, distinct silhouettes.
 * Each icon has unique shape language, material feel, and lighting.
 * No background circles — cosmetic layers (bg, aura, frame) show through.
 */

import { useId } from 'react';

interface SvgAvatarProps {
  className?: string;
}

function useGradientIds() {
  const raw = useId();
  const uid = raw.replace(/:/g, '');
  return (suffix: string) => `av${uid}${suffix}`;
}

// ── 1. Shadow Ninja — sharp angular mask, narrow silhouette ──
function SmileAvatar({ className }: SvgAvatarProps) {
  const gid = useGradientIds();
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id={gid('hood')} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
          <stop offset="30%" stopColor="#3a3a5a" />
          <stop offset="70%" stopColor="#1e1e35" />
          <stop offset="100%" stopColor="#0d0d1a" />
        </linearGradient>
        <radialGradient id={gid('glow')} cx="50%" cy="48%" r="25%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.7" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id={gid('wrap')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a3a55" />
          <stop offset="100%" stopColor="#18182d" />
        </linearGradient>
      </defs>
      {/* Hood — sharp pointed top */}
      <path d="M16 1 L24 8 Q26 12 26 17 L26 19 Q26 21 24 21 L8 21 Q6 21 6 19 L6 17 Q6 12 8 8Z" fill={`url(#${gid('hood')})`} />
      {/* Hood left shine */}
      <path d="M16 1 L8 8 Q6 12 6 17 L8 14 L12 5Z" fill="white" fillOpacity="0.06" />
      {/* Hood right shadow */}
      <path d="M16 1 L24 8 Q26 12 26 17 L24 14 L20 5Z" fill="black" fillOpacity="0.2" />
      {/* Hood peak highlight */}
      <path d="M14 3 L16 1 L18 3" stroke="white" strokeWidth="0.4" strokeOpacity="0.15" strokeLinecap="round" fill="none" />
      {/* Eye slit — narrow angular */}
      <path d="M8.5 13 L16 11.5 L23.5 13 L16 14.5Z" fill="#050510" />
      {/* Eye glow */}
      <ellipse cx="16" cy="13" rx="6" ry="2.5" fill={`url(#${gid('glow')})`} />
      {/* Eyes — sharp narrow */}
      <ellipse cx="12" cy="13" rx="1.8" ry="0.7" fill="#c4b5fd" />
      <ellipse cx="20" cy="13" rx="1.8" ry="0.7" fill="#c4b5fd" />
      <ellipse cx="12" cy="12.8" rx="0.8" ry="0.4" fill="white" fillOpacity="0.8" />
      <ellipse cx="20" cy="12.8" rx="0.8" ry="0.4" fill="white" fillOpacity="0.8" />
      {/* Face wrap — angular jaw */}
      <path d="M8 17 L24 17 L22 24 Q16 27 10 24Z" fill={`url(#${gid('wrap')})`} />
      <path d="M8 17 L24 17" stroke="#4a4a65" strokeWidth="0.4" />
      {/* Wrap folds */}
      <path d="M13 18 L11.5 23" stroke="#0f0f20" strokeWidth="0.4" strokeOpacity="0.5" />
      <path d="M19 18 L20.5 23" stroke="#0f0f20" strokeWidth="0.4" strokeOpacity="0.5" />
      {/* Chin point */}
      <path d="M12 23 L16 26 L20 23" stroke="#2a2a45" strokeWidth="0.3" fill="none" />
    </svg>
  );
}

// ── 2. Cyber Visor — angular helmet, sharp jaw, tech lines ──
function CoolAvatar({ className }: SvgAvatarProps) {
  const gid = useGradientIds();
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id={gid('helm')} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#6b7280" />
          <stop offset="30%" stopColor="#374151" />
          <stop offset="70%" stopColor="#1f2937" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id={gid('visor')} x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0%" stopColor="#0891b2" />
          <stop offset="25%" stopColor="#22d3ee" />
          <stop offset="60%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <radialGradient id={gid('vglow')} cx="50%" cy="50%" r="40%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      {/* Helmet — angular with chin guard */}
      <path d="M16 2 L25 7 Q27 10 27 15 L27 18 L24 22 L22 27 L16 29 L10 27 L8 22 L5 18 L5 15 Q5 10 7 7Z" fill={`url(#${gid('helm')})`} />
      {/* Left edge highlight */}
      <path d="M16 2 L7 7 Q5 10 5 15 L7 12 L12 4Z" fill="white" fillOpacity="0.07" />
      {/* Top ridge */}
      <path d="M12 3.5 L16 2 L20 3.5" stroke="#9ca3af" strokeWidth="0.8" strokeLinecap="round" fill="none" />
      {/* Center seam */}
      <path d="M16 2 L16 10" stroke="#4b5563" strokeWidth="0.4" />
      {/* Visor glow */}
      <ellipse cx="16" cy="14" rx="11" ry="4" fill={`url(#${gid('vglow')})`} />
      {/* Visor — angular shape */}
      <path d="M7 12 L25 12 L24 17 Q16 19.5 8 17Z" fill={`url(#${gid('visor')})`} />
      {/* Visor reflection */}
      <path d="M8 12.5 L18 12 Q15 14.5 8 14Z" fill="white" fillOpacity="0.3" />
      {/* Visor top edge glow */}
      <path d="M7 12 L25 12" stroke="#67e8f9" strokeWidth="0.4" strokeOpacity="0.6" />
      {/* Chin guard */}
      <path d="M10 22 L16 25 L22 22" stroke="#475569" strokeWidth="0.6" fill="none" />
      <path d="M12 23 L16 26 L20 23" stroke="#374151" strokeWidth="0.4" fill="none" />
      {/* Side vents */}
      <rect x="5.5" y="18" width="2.5" height="0.5" rx="0.25" fill="#22d3ee" fillOpacity="0.5" />
      <rect x="5.5" y="19.5" width="2" height="0.4" rx="0.2" fill="#22d3ee" fillOpacity="0.3" />
      <rect x="24" y="18" width="2.5" height="0.5" rx="0.25" fill="#22d3ee" fillOpacity="0.5" />
      <rect x="24.5" y="19.5" width="2" height="0.4" rx="0.2" fill="#22d3ee" fillOpacity="0.3" />
      {/* Ear panels */}
      <path d="M5 15 L3 16 L5 18" stroke="#4b5563" strokeWidth="0.5" fill="#1f2937" />
      <path d="M27 15 L29 16 L27 18" stroke="#4b5563" strokeWidth="0.5" fill="#1f2937" />
    </svg>
  );
}

// ── 3. Inferno Skull — wide skull, ember cracks, strong jaw ──
function FireAvatar({ className }: SvgAvatarProps) {
  const gid = useGradientIds();
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <defs>
        <radialGradient id={gid('skull')} cx="45%" cy="30%" r="55%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="25%" stopColor="#e7e5e4" />
          <stop offset="60%" stopColor="#a8a29e" />
          <stop offset="100%" stopColor="#57534e" />
        </radialGradient>
        <radialGradient id={gid('eyeL')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="40%" stopColor="#fbbf24" />
          <stop offset="80%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={gid('eyeR')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="40%" stopColor="#fbbf24" />
          <stop offset="80%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Cranium — wider, more pronounced */}
      <path d="M5 16 Q5 3 16 1 Q27 3 27 16 L27 18 Q27 20 25 20 L7 20 Q5 20 5 18Z" fill={`url(#${gid('skull')})`} />
      {/* Cranium highlight */}
      <path d="M9 5 Q16 1 23 5 Q19 2.5 16 2.5 Q13 2.5 9 5Z" fill="white" fillOpacity="0.25" />
      {/* Left shine */}
      <path d="M5 16 Q5 3 16 1 L8 7 L5 14Z" fill="white" fillOpacity="0.12" />
      {/* Right shadow */}
      <path d="M27 16 Q27 3 16 1 L24 7 L27 14Z" fill="black" fillOpacity="0.15" />
      {/* Brow ridge */}
      <path d="M8 10 L12 8.5 L16 9.5 L20 8.5 L24 10" stroke="#78716c" strokeWidth="0.5" fill="none" />
      {/* Eye sockets — deep angular */}
      <path d="M8.5 11 L13 9.5 L15 13 L13 15.5 L8 14Z" fill="#1a0505" />
      <path d="M23.5 11 L19 9.5 L17 13 L19 15.5 L24 14Z" fill="#1a0505" />
      {/* Eye glow */}
      <ellipse cx="12" cy="12.5" rx="2.2" ry="2" fill={`url(#${gid('eyeL')})`} />
      <ellipse cx="20" cy="12.5" rx="2.2" ry="2" fill={`url(#${gid('eyeR')})`} />
      {/* Eye hot center */}
      <ellipse cx="12" cy="12" rx="0.8" ry="0.7" fill="white" fillOpacity="0.7" />
      <ellipse cx="20" cy="12" rx="0.8" ry="0.7" fill="white" fillOpacity="0.7" />
      {/* Nose cavity */}
      <path d="M14 16.5 L16 18.5 L18 16.5 L17 15.5 L15 15.5Z" fill="#1a0505" />
      {/* Jaw — wider, pronounced teeth */}
      <path d="M7 20 L7 22 Q7 27 16 29 Q25 27 25 22 L25 20Z" fill={`url(#${gid('skull')})`} />
      {/* Jaw shadow */}
      <path d="M7 20 L25 20" stroke="#57534e" strokeWidth="0.6" />
      {/* Teeth — distinct */}
      <path d="M9 20 L9 22.5" stroke="#78716c" strokeWidth="0.5" />
      <path d="M11.5 20 L11.5 24" stroke="#78716c" strokeWidth="0.5" />
      <path d="M14 20 L14 25.5" stroke="#78716c" strokeWidth="0.5" />
      <path d="M16 20 L16 26" stroke="#78716c" strokeWidth="0.5" />
      <path d="M18 20 L18 25.5" stroke="#78716c" strokeWidth="0.5" />
      <path d="M20.5 20 L20.5 24" stroke="#78716c" strokeWidth="0.5" />
      <path d="M23 20 L23 22.5" stroke="#78716c" strokeWidth="0.5" />
      {/* Ember cracks */}
      <path d="M10 6 L9 9 L10.5 11" stroke="#f97316" strokeWidth="0.4" strokeOpacity="0.6" fill="none" />
      <path d="M22 5 L23 8 L22 10" stroke="#f97316" strokeWidth="0.3" strokeOpacity="0.5" fill="none" />
      <path d="M15 5 L14.5 7" stroke="#fbbf24" strokeWidth="0.3" strokeOpacity="0.4" fill="none" />
    </svg>
  );
}

// ── 4. Crystal Orb — faceted gem with inner light ──
function StarAvatar({ className }: SvgAvatarProps) {
  const gid = useGradientIds();
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <defs>
        <radialGradient id={gid('orb')} cx="38%" cy="30%" r="55%">
          <stop offset="0%" stopColor="#e9d5ff" />
          <stop offset="25%" stopColor="#a78bfa" />
          <stop offset="55%" stopColor="#7c3aed" />
          <stop offset="85%" stopColor="#4c1d95" />
          <stop offset="100%" stopColor="#2e1065" />
        </radialGradient>
        <radialGradient id={gid('glow')} cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.6" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id={gid('inner')} cx="35%" cy="28%" r="30%">
          <stop offset="0%" stopColor="white" stopOpacity="0.5" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      {/* Outer glow — larger and softer */}
      <circle cx="16" cy="14" r="14" fill={`url(#${gid('glow')})`} />
      {/* Orb body — larger */}
      <circle cx="16" cy="14" r="11" fill={`url(#${gid('orb')})`} />
      {/* Facet lines — crystalline structure */}
      <path d="M10 7 L16 3 L22 7" stroke="#c4b5fd" strokeWidth="0.3" strokeOpacity="0.3" fill="none" />
      <path d="M7 14 L10 7 L16 5 L22 7 L25 14" stroke="#c4b5fd" strokeWidth="0.25" strokeOpacity="0.2" fill="none" />
      <path d="M7 14 L10 21 L16 24 L22 21 L25 14" stroke="#6d28d9" strokeWidth="0.25" strokeOpacity="0.2" fill="none" />
      <path d="M16 5 L16 24" stroke="#8b5cf6" strokeWidth="0.2" strokeOpacity="0.15" />
      <path d="M7 14 L25 14" stroke="#8b5cf6" strokeWidth="0.2" strokeOpacity="0.15" />
      {/* Inner light spot */}
      <circle cx="13" cy="10" r="5" fill={`url(#${gid('inner')})`} />
      {/* Main highlight arc — bright */}
      <path d="M9 9 Q13 5 19 7" stroke="white" strokeWidth="1.2" strokeOpacity="0.4" strokeLinecap="round" fill="none" />
      {/* Secondary highlight */}
      <path d="M10.5 11.5 Q12 10 14.5 9.5" stroke="white" strokeWidth="0.6" strokeOpacity="0.25" strokeLinecap="round" fill="none" />
      {/* Core star rune */}
      <path d="M16 7 L17.5 12 L22 12.5 L18.5 15 L19.5 20 L16 17 L12.5 20 L13.5 15 L10 12.5 L14.5 12Z" fill="#ddd6fe" fillOpacity="0.1" />
      {/* Center spark */}
      <circle cx="16" cy="14" r="2" fill="#e9d5ff" fillOpacity="0.25" />
      <circle cx="16" cy="14" r="0.8" fill="white" fillOpacity="0.6" />
      {/* Bottom reflection */}
      <path d="M12 20 Q16 22 20 20" stroke="white" strokeWidth="0.3" strokeOpacity="0.08" fill="none" />
      {/* Pedestal — ornate base */}
      <path d="M10 26 L12.5 23 L16 22 L19.5 23 L22 26" stroke="#7c3aed" strokeWidth="0.7" strokeOpacity="0.5" fill="none" />
      <path d="M11 26 L16 27.5 L21 26" stroke="#6d28d9" strokeWidth="0.5" strokeOpacity="0.3" fill="none" />
      <ellipse cx="16" cy="27" rx="6" ry="1" fill="#7c3aed" fillOpacity="0.12" />
    </svg>
  );
}

// ── 5. Phantom Mask — elongated opera mask, asymmetric crack ──
function GhostAvatar({ className }: SvgAvatarProps) {
  const gid = useGradientIds();
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id={gid('mask')} x1="0.25" y1="0" x2="0.75" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="30%" stopColor="#e2e8f0" />
          <stop offset="60%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <radialGradient id={gid('glow')} cx="50%" cy="40%" r="30%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      {/* Wispy trails — ethereal bottom */}
      <path d="M10 24 Q7 28 4 30" stroke="#cbd5e1" strokeWidth="0.7" strokeOpacity="0.12" strokeLinecap="round" fill="none" />
      <path d="M16 27 Q15 30 14 31" stroke="#94a3b8" strokeWidth="0.6" strokeOpacity="0.08" strokeLinecap="round" fill="none" />
      <path d="M22 24 Q25 28 28 30" stroke="#cbd5e1" strokeWidth="0.7" strokeOpacity="0.12" strokeLinecap="round" fill="none" />
      {/* Mask — elongated, sharp chin */}
      <path d="M7 14 Q7 2 16 1 Q25 2 25 14 L25 18 Q25 24 16 28 Q7 24 7 18Z" fill={`url(#${gid('mask')})`} />
      {/* Left highlight — strong */}
      <path d="M7 14 Q7 2 16 1 L10 5 L7 12Z" fill="white" fillOpacity="0.2" />
      {/* Right shadow */}
      <path d="M25 14 Q25 2 16 1 L22 5 L25 12Z" fill="black" fillOpacity="0.12" />
      {/* Brow ridge */}
      <path d="M9 9 L14 8 L18 8 L23 9" stroke="#64748b" strokeWidth="0.4" strokeOpacity="0.5" fill="none" />
      {/* Eye glow */}
      <ellipse cx="13" cy="12" rx="4" ry="3" fill={`url(#${gid('glow')})`} />
      <ellipse cx="19" cy="12" rx="4" ry="3" fill={`url(#${gid('glow')})`} />
      {/* Eye hollows — sharp diamond */}
      <path d="M10 12 L13 9 L15 12 L13 15Z" fill="#0f172a" />
      <path d="M22 12 L19 9 L17 12 L19 15Z" fill="#0f172a" />
      {/* Glowing irises */}
      <circle cx="12.8" cy="12" r="1.3" fill="#38bdf8" />
      <circle cx="19.2" cy="12" r="1.3" fill="#38bdf8" />
      <circle cx="12.5" cy="11.5" r="0.5" fill="#e0f2fe" fillOpacity="0.9" />
      <circle cx="18.9" cy="11.5" r="0.5" fill="#e0f2fe" fillOpacity="0.9" />
      {/* Mask crack — asymmetric, left side */}
      <path d="M13 4 L12.5 7 L14 9" stroke="#475569" strokeWidth="0.5" strokeOpacity="0.5" fill="none" />
      <path d="M14 9 L13 13 L14.5 16 L13.5 20" stroke="#475569" strokeWidth="0.4" strokeOpacity="0.4" fill="none" />
      {/* Small chips along crack */}
      <path d="M12 7 L11.5 8" stroke="#475569" strokeWidth="0.3" strokeOpacity="0.3" />
      <path d="M13.5 14 L12.5 14.5" stroke="#475569" strokeWidth="0.3" strokeOpacity="0.3" />
      {/* Cheekbone contour */}
      <path d="M9 16 Q11 15 14 16" stroke="white" strokeWidth="0.3" strokeOpacity="0.08" fill="none" />
      <path d="M23 16 Q21 15 18 16" stroke="white" strokeWidth="0.3" strokeOpacity="0.08" fill="none" />
    </svg>
  );
}

// ── 6. Mech Core — hexagonal housing, targeting reticle ──
function RobotAvatar({ className }: SvgAvatarProps) {
  const gid = useGradientIds();
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <defs>
        <radialGradient id={gid('core')} cx="42%" cy="38%" r="50%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="35%" stopColor="#22d3ee" />
          <stop offset="70%" stopColor="#0891b2" />
          <stop offset="100%" stopColor="#164e63" />
        </radialGradient>
        <radialGradient id={gid('glow')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id={gid('housing')} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#4b5563" />
          <stop offset="50%" stopColor="#1f2937" />
          <stop offset="100%" stopColor="#111827" />
        </linearGradient>
      </defs>
      {/* Core glow */}
      <circle cx="16" cy="16" r="14" fill={`url(#${gid('glow')})`} />
      {/* Hexagonal housing */}
      <path d="M16 3 L26 9 L26 23 L16 29 L6 23 L6 9Z" fill={`url(#${gid('housing')})`} />
      {/* Housing highlight */}
      <path d="M16 3 L6 9 L6 12 L16 5Z" fill="white" fillOpacity="0.06" />
      {/* Housing edges */}
      <path d="M16 3 L26 9 L26 23 L16 29 L6 23 L6 9Z" fill="none" stroke="#4b5563" strokeWidth="0.5" />
      {/* Inner bevel */}
      <path d="M16 6 L23 10.5 L23 21.5 L16 26 L9 21.5 L9 10.5Z" fill="none" stroke="#374151" strokeWidth="0.4" />
      {/* Core iris — large */}
      <circle cx="16" cy="16" r="7" fill={`url(#${gid('core')})`} />
      {/* Iris rings */}
      <circle cx="16" cy="16" r="5.5" fill="none" stroke="#0e7490" strokeWidth="0.3" strokeOpacity="0.5" />
      <circle cx="16" cy="16" r="4" fill="none" stroke="#22d3ee" strokeWidth="0.2" strokeOpacity="0.4" />
      {/* Pupil */}
      <circle cx="16" cy="16" r="2.5" fill="#042f2e" />
      <circle cx="16" cy="16" r="1.5" fill="#22d3ee" />
      <circle cx="16" cy="16" r="0.5" fill="white" fillOpacity="0.8" />
      {/* Highlight */}
      <circle cx="13.5" cy="13.5" r="1.8" fill="white" fillOpacity="0.2" />
      {/* Targeting reticle */}
      <path d="M16 8.5 L16 11" stroke="#22d3ee" strokeWidth="0.4" strokeOpacity="0.6" />
      <path d="M16 21 L16 23.5" stroke="#22d3ee" strokeWidth="0.4" strokeOpacity="0.6" />
      <path d="M8.5 16 L11 16" stroke="#22d3ee" strokeWidth="0.4" strokeOpacity="0.6" />
      <path d="M21 16 L23.5 16" stroke="#22d3ee" strokeWidth="0.4" strokeOpacity="0.6" />
      {/* Corner brackets */}
      <path d="M4 8 L6 9" stroke="#22d3ee" strokeWidth="0.4" strokeOpacity="0.3" />
      <path d="M28 8 L26 9" stroke="#22d3ee" strokeWidth="0.4" strokeOpacity="0.3" />
      <path d="M4 24 L6 23" stroke="#22d3ee" strokeWidth="0.4" strokeOpacity="0.3" />
      <path d="M28 24 L26 23" stroke="#22d3ee" strokeWidth="0.4" strokeOpacity="0.3" />
    </svg>
  );
}

// ── 7. Void Rift — irregular torn portal with energy tendrils ──
function AlienAvatar({ className }: SvgAvatarProps) {
  const gid = useGradientIds();
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <defs>
        <radialGradient id={gid('void')} cx="50%" cy="50%" r="40%">
          <stop offset="0%" stopColor="#020617" />
          <stop offset="45%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#312e81" />
        </radialGradient>
        <radialGradient id={gid('glow')} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id={gid('center')} cx="50%" cy="50%" r="30%">
          <stop offset="0%" stopColor="#e0e7ff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      {/* Ambient glow */}
      <circle cx="16" cy="16" r="14" fill={`url(#${gid('glow')})`} />
      {/* Rift tear — irregular shape instead of circle */}
      <path d="M16 3 Q22 4 26 8 Q28 12 27 16 Q28 21 25 25 Q21 28 16 29 Q11 28 7 25 Q4 21 5 16 Q4 12 6 8 Q10 4 16 3Z" fill={`url(#${gid('void')})`} />
      {/* Rift edge glow */}
      <path d="M16 3 Q22 4 26 8 Q28 12 27 16 Q28 21 25 25 Q21 28 16 29 Q11 28 7 25 Q4 21 5 16 Q4 12 6 8 Q10 4 16 3Z" fill="none" stroke="#6366f1" strokeWidth="1" strokeOpacity="0.6" />
      <path d="M16 3 Q22 4 26 8 Q28 12 27 16 Q28 21 25 25 Q21 28 16 29 Q11 28 7 25 Q4 21 5 16 Q4 12 6 8 Q10 4 16 3Z" fill="none" stroke="#a5b4fc" strokeWidth="0.3" strokeOpacity="0.3" />
      {/* Edge highlight */}
      <path d="M8 5 Q13 3 18 4" stroke="#c7d2fe" strokeWidth="0.4" strokeOpacity="0.3" strokeLinecap="round" fill="none" />
      {/* Swirl tendrils — more dynamic */}
      <path d="M10 9 Q14 13 16 16 Q18 19 22 23" stroke="#6366f1" strokeWidth="0.8" strokeOpacity="0.5" fill="none" />
      <path d="M22 9 Q18 13 16 16 Q14 19 10 23" stroke="#818cf8" strokeWidth="0.6" strokeOpacity="0.4" fill="none" />
      <path d="M16 5 Q18 10 16 16 Q14 22 16 27" stroke="#a5b4fc" strokeWidth="0.5" strokeOpacity="0.3" fill="none" />
      <path d="M5 16 Q10 14 16 16 Q22 18 27 16" stroke="#6366f1" strokeWidth="0.4" strokeOpacity="0.3" fill="none" />
      {/* Central eye — stronger */}
      <circle cx="16" cy="16" r="4" fill={`url(#${gid('center')})`} />
      <circle cx="16" cy="16" r="3" fill="#1e1b4b" stroke="#818cf8" strokeWidth="0.7" />
      <circle cx="16" cy="16" r="1.8" fill="#a5b4fc" />
      <circle cx="16" cy="16" r="0.7" fill="white" fillOpacity="0.9" />
      {/* Energy particles — larger */}
      <circle cx="8" cy="9" r="0.6" fill="#c7d2fe" fillOpacity="0.8" />
      <circle cx="24" cy="23" r="0.5" fill="#a5b4fc" fillOpacity="0.7" />
      <circle cx="9" cy="23" r="0.45" fill="#818cf8" fillOpacity="0.6" />
      <circle cx="23" cy="8" r="0.5" fill="#c7d2fe" fillOpacity="0.7" />
      <circle cx="6" cy="17" r="0.35" fill="#818cf8" fillOpacity="0.5" />
      <circle cx="26" cy="14" r="0.4" fill="#a5b4fc" fillOpacity="0.5" />
      <circle cx="13" cy="6" r="0.3" fill="#e0e7ff" fillOpacity="0.5" />
      <circle cx="19" cy="26" r="0.35" fill="#818cf8" fillOpacity="0.4" />
    </svg>
  );
}

// ── 8. Dark Blade — crossed katanas, angular guards ──
function NinjaAvatar({ className }: SvgAvatarProps) {
  const gid = useGradientIds();
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id={gid('bl1')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="30%" stopColor="#cbd5e1" />
          <stop offset="60%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <linearGradient id={gid('bl2')} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="30%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <radialGradient id={gid('gem')} cx="38%" cy="32%" r="50%">
          <stop offset="0%" stopColor="#fecaca" />
          <stop offset="40%" stopColor="#ef4444" />
          <stop offset="80%" stopColor="#b91c1c" />
          <stop offset="100%" stopColor="#450a0a" />
        </radialGradient>
        <radialGradient id={gid('glow')} cx="50%" cy="50%" r="30%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.5" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      {/* Center glow */}
      <circle cx="16" cy="16" r="7" fill={`url(#${gid('glow')})`} />
      {/* Blade 1 — curved katana style */}
      <path d="M5 27 L7 25 L23.5 5 L25.5 4.5 L25 6.5 L8.5 26Z" fill={`url(#${gid('bl1')})`} />
      <path d="M7 25 L24 5.5" stroke="white" strokeWidth="0.5" strokeOpacity="0.5" />
      <path d="M8.5 26 L25 6.5" stroke="black" strokeWidth="0.3" strokeOpacity="0.15" />
      {/* Blade 1 tip */}
      <path d="M23.5 5 L25.5 4.5 L25 6.5" fill="#e2e8f0" />
      {/* Guard 1 — angular tsuba */}
      <path d="M6 24 L10 22 L10 27 L6 28Z" fill="#78350f" stroke="#92400e" strokeWidth="0.4" />
      <path d="M6.5 24.5 L9.5 23" stroke="#b45309" strokeWidth="0.3" />
      {/* Blade 2 */}
      <path d="M27 27 L25 25 L8.5 5 L6.5 4.5 L7 6.5 L23.5 26Z" fill={`url(#${gid('bl2')})`} />
      <path d="M25 25 L8 5.5" stroke="white" strokeWidth="0.4" strokeOpacity="0.4" />
      {/* Blade 2 tip */}
      <path d="M8.5 5 L6.5 4.5 L7 6.5" fill="#cbd5e1" />
      {/* Guard 2 */}
      <path d="M26 24 L22 22 L22 27 L26 28Z" fill="#78350f" stroke="#92400e" strokeWidth="0.4" />
      <path d="M25.5 24.5 L22.5 23" stroke="#b45309" strokeWidth="0.3" />
      {/* Center gem mount — faceted */}
      <path d="M16 12 L20 16 L16 20 L12 16Z" fill="#1c1917" stroke="#78350f" strokeWidth="0.8" />
      {/* Gem — faceted diamond */}
      <path d="M16 13 L19 16 L16 19 L13 16Z" fill={`url(#${gid('gem')})`} />
      {/* Gem facet highlights */}
      <path d="M14 15 L16 13 L17 15Z" fill="white" fillOpacity="0.25" />
      <circle cx="15" cy="15" r="0.5" fill="white" fillOpacity="0.6" />
    </svg>
  );
}

// ── 9. Arcane Eye — elongated cat-eye with energy wisps ──
function CatAvatar({ className }: SvgAvatarProps) {
  const gid = useGradientIds();
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <defs>
        <radialGradient id={gid('iris')} cx="42%" cy="42%" r="50%">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="30%" stopColor="#4ade80" />
          <stop offset="60%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#052e16" />
        </radialGradient>
        <radialGradient id={gid('glow')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.5" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id={gid('lid')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2e1a" />
          <stop offset="100%" stopColor="#0a1f0a" />
        </linearGradient>
      </defs>
      {/* Arcane glow — wide */}
      <ellipse cx="16" cy="16" rx="15" ry="9" fill={`url(#${gid('glow')})`} />
      {/* Energy wisps — emanating from eye corners */}
      <path d="M1 14 Q3 11 5 14" stroke="#22c55e" strokeWidth="0.5" strokeOpacity="0.3" fill="none" />
      <path d="M0 16 Q2 18 4 16" stroke="#4ade80" strokeWidth="0.4" strokeOpacity="0.2" fill="none" />
      <path d="M31 14 Q29 11 27 14" stroke="#22c55e" strokeWidth="0.5" strokeOpacity="0.3" fill="none" />
      <path d="M32 16 Q30 18 28 16" stroke="#4ade80" strokeWidth="0.4" strokeOpacity="0.2" fill="none" />
      {/* Outer eyelid shape — elongated */}
      <path d="M1 16 Q16 4 31 16 Q16 28 1 16Z" fill={`url(#${gid('lid')})`} />
      {/* Lid top edge */}
      <path d="M1 16 Q16 4 31 16" stroke="#16a34a" strokeWidth="0.6" strokeOpacity="0.5" fill="none" />
      {/* Lid bottom edge */}
      <path d="M1 16 Q16 28 31 16" stroke="#16a34a" strokeWidth="0.4" strokeOpacity="0.3" fill="none" />
      {/* Inner eye white */}
      <path d="M4 16 Q16 7 28 16 Q16 25 4 16Z" fill="#071a07" />
      {/* Iris — large */}
      <circle cx="16" cy="16" r="6.5" fill={`url(#${gid('iris')})`} />
      {/* Iris detail */}
      <circle cx="16" cy="16" r="5.5" fill="none" stroke="#22c55e" strokeWidth="0.3" strokeOpacity="0.5" />
      <circle cx="16" cy="16" r="4.2" fill="none" stroke="#4ade80" strokeWidth="0.2" strokeOpacity="0.4" />
      {/* Iris streaks — radial */}
      <path d="M16 10 L16 12" stroke="#86efac" strokeWidth="0.3" strokeOpacity="0.3" />
      <path d="M16 20 L16 22" stroke="#86efac" strokeWidth="0.3" strokeOpacity="0.3" />
      <path d="M10 16 L12 16" stroke="#86efac" strokeWidth="0.3" strokeOpacity="0.3" />
      <path d="M20 16 L22 16" stroke="#86efac" strokeWidth="0.3" strokeOpacity="0.3" />
      {/* Pupil — vertical slit, thinner */}
      <ellipse cx="16" cy="16" rx="1.5" ry="6" fill="#020617" />
      <ellipse cx="16" cy="16" rx="0.6" ry="4" fill="#052e16" fillOpacity="0.4" />
      {/* Strong highlight */}
      <circle cx="13.5" cy="13" r="1.5" fill="white" fillOpacity="0.4" />
      <circle cx="18.5" cy="19" r="0.7" fill="white" fillOpacity="0.2" />
      {/* Rune marks — floating around eye */}
      <path d="M3 11 L5 9" stroke="#22c55e" strokeWidth="0.5" strokeOpacity="0.4" />
      <path d="M3 21 L5 23" stroke="#22c55e" strokeWidth="0.5" strokeOpacity="0.4" />
      <path d="M29 11 L27 9" stroke="#22c55e" strokeWidth="0.5" strokeOpacity="0.4" />
      <path d="M29 21 L27 23" stroke="#22c55e" strokeWidth="0.5" strokeOpacity="0.4" />
    </svg>
  );
}

// ── 10. Neon Shield — angular crest with energy core ──
function RocketAvatar({ className }: SvgAvatarProps) {
  const gid = useGradientIds();
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id={gid('shield')} x1="0.2" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="30%" stopColor="#3b82f6" />
          <stop offset="70%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
        <radialGradient id={gid('glow')} cx="50%" cy="40%" r="45%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id={gid('bolt')} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="white" />
          <stop offset="50%" stopColor="#bfdbfe" />
          <stop offset="100%" stopColor="#93c5fd" />
        </linearGradient>
      </defs>
      {/* Shield glow */}
      <path d="M16 1 L28 7 L28 17 Q28 26 16 31 Q4 26 4 17 L4 7Z" fill={`url(#${gid('glow')})`} />
      {/* Shield body — more angular */}
      <path d="M16 2.5 L26.5 8 L26.5 17 Q26.5 25 16 29 Q5.5 25 5.5 17 L5.5 8Z" fill={`url(#${gid('shield')})`} fillOpacity="0.25" stroke="#3b82f6" strokeWidth="1.2" />
      {/* Inner shield border */}
      <path d="M16 5.5 L23 9 L23 17 Q23 23 16 26 Q9 23 9 17 L9 9Z" fill="none" stroke="#60a5fa" strokeWidth="0.5" strokeOpacity="0.6" />
      {/* Shield top facet highlight */}
      <path d="M7 8.5 L16 3.5 L25 8.5 L16 7Z" fill="white" fillOpacity="0.12" />
      {/* Left face highlight */}
      <path d="M5.5 8 L16 2.5 L8 8 L5.5 14Z" fill="white" fillOpacity="0.08" />
      {/* Shield horizontal divider */}
      <path d="M7 14 L25 14" stroke="#60a5fa" strokeWidth="0.3" strokeOpacity="0.3" />
      {/* Lightning bolt — sharper, more detailed */}
      <path d="M19 7 L14 14.5 L17.5 14.5 L12 25 L21 13.5 L17 13.5Z" fill={`url(#${gid('bolt')})`} />
      <path d="M19 7 L14 14.5 L17.5 14.5 L12 25 L21 13.5 L17 13.5Z" fill="white" fillOpacity="0.15" />
      {/* Bolt edge glow */}
      <path d="M19 7 L14 14.5" stroke="white" strokeWidth="0.3" strokeOpacity="0.3" />
      <path d="M12 25 L21 13.5" stroke="white" strokeWidth="0.3" strokeOpacity="0.3" />
      {/* Top crest point */}
      <circle cx="16" cy="3" r="1" fill="#60a5fa" fillOpacity="0.7" />
      <circle cx="16" cy="3" r="0.4" fill="white" fillOpacity="0.5" />
      {/* Corner rivets */}
      <circle cx="6" cy="8.5" r="0.6" fill="#60a5fa" fillOpacity="0.5" />
      <circle cx="26" cy="8.5" r="0.6" fill="#60a5fa" fillOpacity="0.5" />
      <circle cx="16" cy="29" r="0.5" fill="#3b82f6" fillOpacity="0.4" />
    </svg>
  );
}

// ── Registry mapping ──

const SVG_AVATAR_MAP: Record<string, React.ComponentType<SvgAvatarProps>> = {
  'default.smile':  SmileAvatar,   // Shadow Ninja
  'default.cool':   CoolAvatar,    // Cyber Visor
  'default.fire':   FireAvatar,    // Inferno Skull
  'default.star':   StarAvatar,    // Crystal Orb
  'default.ghost':  GhostAvatar,   // Phantom Mask
  'default.robot':  RobotAvatar,   // Mech Core
  'default.alien':  AlienAvatar,   // Void Rift
  'default.ninja':  NinjaAvatar,   // Dark Blade
  'default.cat':    CatAvatar,     // Arcane Eye
  'default.rocket': RocketAvatar,  // Neon Shield
};

export function SvgAvatar({ avatarId, className }: { avatarId: string; className?: string }) {
  const Component = SVG_AVATAR_MAP[avatarId];
  if (!Component) return null;
  return <Component className={className} />;
}

export function hasSvgAvatar(avatarId: string): boolean {
  return avatarId in SVG_AVATAR_MAP;
}
