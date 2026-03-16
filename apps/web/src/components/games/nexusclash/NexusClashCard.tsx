'use client';

import { useMemo } from 'react';
import type { NcCardDef, NcRarity, NcTag } from 'shared';
import { NC_CARD_MAP } from 'shared';
import { useI18n } from '@/components/providers/LanguageProvider';

// ── Rarity Styling (Nexus Clash palette) ─────────────────────────────────────

const RARITY_BORDER: Record<NcRarity, string> = {
  common:    '#3a3a4a',
  rare:      '#4a7dff',
  epic:      '#7c3aed',
  legendary: '#c9a84c',
};

const RARITY_BG: Record<NcRarity, string> = {
  common:    'linear-gradient(180deg, #18182a, #0e0e1a)',
  rare:      'linear-gradient(180deg, #0e1a2e, #0a0e1a)',
  epic:      'linear-gradient(180deg, #1a0e2e, #0e0a1a)',
  legendary: 'linear-gradient(180deg, #1a1808, #12100a)',
};

const RARITY_GLOW: Record<NcRarity, string> = {
  common:    'none',
  rare:      '0 0 8px rgba(74,125,255,0.2)',
  epic:      '0 0 12px rgba(124,58,237,0.3)',
  legendary: '0 0 16px rgba(201,168,76,0.4)',
};

const RARITY_COST_BG: Record<NcRarity, string> = {
  common:    'linear-gradient(135deg, #3a3a4a, #2a2a3a)',
  rare:      'linear-gradient(135deg, #4a7dff, #2a4aaa)',
  epic:      'linear-gradient(135deg, #7c3aed, #5b21b6)',
  legendary: 'linear-gradient(135deg, #c9a84c, #a07c2a)',
};

const TAG_ICONS: Record<NcTag, React.ReactNode> = {
  divine: <svg viewBox="0 0 12 12" className="w-3 h-3"><polygon points="6,1 7.5,4.5 11,4.5 8,7 9.5,11 6,8.5 2.5,11 4,7 1,4.5 4.5,4.5" fill="#c9a84c" opacity="0.8"/></svg>,
  arcane: <svg viewBox="0 0 12 12" className="w-3 h-3"><circle cx="6" cy="6" r="4" fill="none" stroke="#a78bfa" strokeWidth="1"/><circle cx="6" cy="6" r="1.5" fill="#a78bfa"/></svg>,
  beast: <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M3 8C3 8 4 4 6 4C8 4 9 8 9 8" fill="none" stroke="#c9a84c" strokeWidth="1" strokeLinecap="round"/><circle cx="4.5" cy="6" r="0.8" fill="#c9a84c"/><circle cx="7.5" cy="6" r="0.8" fill="#c9a84c"/></svg>,
  mech: <svg viewBox="0 0 12 12" className="w-3 h-3"><circle cx="6" cy="6" r="4" fill="none" stroke="#6a8aaa" strokeWidth="1"/><circle cx="6" cy="6" r="1.5" fill="#6a8aaa"/></svg>,
  undead: <svg viewBox="0 0 12 12" className="w-3 h-3"><circle cx="6" cy="5" r="3.5" fill="none" stroke="#8a8a9a" strokeWidth="0.8"/><circle cx="4.5" cy="4.5" r="1" fill="#1a1a2a"/><circle cx="7.5" cy="4.5" r="1" fill="#1a1a2a"/><path d="M4 7.5L5 7L6 7.5L7 7L8 7.5" fill="none" stroke="#8a8a9a" strokeWidth="0.6"/></svg>,
  nature: <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M6 2C6 2 2 5 2 8C2 8 4 9 6 7C8 9 10 8 10 8C10 5 6 2 6 2Z" fill="#2a8a4a" opacity="0.8"/></svg>,
  shadow: <svg viewBox="0 0 12 12" className="w-3 h-3"><circle cx="6" cy="6" r="4.5" fill="#1a1a2e" stroke="#4a4a6a" strokeWidth="0.8"/><circle cx="7.5" cy="5" r="3.5" fill="#0a0a12"/></svg>,
  noble: <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M3 9L4 4L6 6L8 4L9 9Z" fill="#c9a84c" opacity="0.8"/><line x1="3" y1="9" x2="9" y2="9" stroke="#c9a84c" strokeWidth="0.8"/></svg>,
};

// ── Card Art Definitions ────────────────────────────────────────────────────

interface CardArt {
  bg: string; // CSS gradient for art panel background
  svg: React.ReactNode; // SVG content (children of <svg>)
}

const CARD_ART: Record<string, CardArt> = {
  // ── Commons ──
  schildbot: {
    bg: 'linear-gradient(180deg, #2d3748 0%, #1a202c 40%, #0d1117 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="sb_core" cx="50%" cy="40%" r="50%"><stop offset="0%" stopColor="#60a5fa" stopOpacity="0.4"/><stop offset="100%" stopColor="#1e3a5f" stopOpacity="0"/></radialGradient>
          <linearGradient id="sb_body" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9ca3af"/><stop offset="100%" stopColor="#4b5563"/></linearGradient>
        </defs>
        {/* Ground glow */}
        <ellipse cx="50" cy="78" rx="28" ry="5" fill="#60a5fa" opacity="0.08"/>
        {/* Core energy field */}
        <circle cx="50" cy="40" r="30" fill="url(#sb_core)"/>
        {/* Body */}
        <path d="M34 28 L38 22 L62 22 L66 28 L68 55 Q68 62 60 65 L40 65 Q32 62 32 55 Z" fill="url(#sb_body)" stroke="#6b7280" strokeWidth="0.8"/>
        {/* Chest plate */}
        <path d="M38 30 L62 30 L60 50 L40 50 Z" fill="#374151" stroke="#4b5563" strokeWidth="0.5"/>
        {/* Shield emblem on chest */}
        <path d="M50 33 L58 37 L58 45 Q58 50 50 53 Q42 50 42 45 L42 37 Z" fill="#1e293b" stroke="#60a5fa" strokeWidth="0.8"/>
        <path d="M50 36 L55 38.5 L55 43 Q55 47 50 49 Q45 47 45 43 L45 38.5 Z" fill="#0f172a" stroke="#3b82f6" strokeWidth="0.5"/>
        {/* Central eye */}
        <circle cx="50" cy="42" r="3.5" fill="#0c4a6e" stroke="#38bdf8" strokeWidth="0.8"/>
        <circle cx="50" cy="42" r="2" fill="#0ea5e9"/>
        <circle cx="50" cy="42" r="0.8" fill="#bae6fd"/>
        <circle cx="49" cy="41" r="0.5" fill="white" opacity="0.8"/>
        {/* Head */}
        <path d="M40 22 L42 14 L46 10 L54 10 L58 14 L60 22 Z" fill="#6b7280" stroke="#9ca3af" strokeWidth="0.5"/>
        <rect x="43" y="14" width="14" height="5" rx="1" fill="#374151" stroke="#4b5563" strokeWidth="0.4"/>
        <rect x="44" y="15" width="4" height="3" rx="0.5" fill="#3b82f6" opacity="0.7"/>
        <rect x="52" y="15" width="4" height="3" rx="0.5" fill="#3b82f6" opacity="0.7"/>
        {/* Antenna */}
        <line x1="50" y1="10" x2="50" y2="5" stroke="#9ca3af" strokeWidth="0.8"/>
        <circle cx="50" cy="4" r="1.5" fill="#60a5fa" opacity="0.9"/>
        <circle cx="50" cy="4" r="0.6" fill="white"/>
        {/* Arms */}
        <path d="M32 32 L26 35 L22 42 L20 50 L24 52 L28 46 L30 38 Z" fill="#6b7280" stroke="#4b5563" strokeWidth="0.4"/>
        <path d="M68 32 L74 35 L78 42 L80 50 L76 52 L72 46 L70 38 Z" fill="#6b7280" stroke="#4b5563" strokeWidth="0.4"/>
        {/* Hand shields */}
        <path d="M20 48 L16 46 L14 50 L16 56 L22 54 Z" fill="#9ca3af" stroke="#60a5fa" strokeWidth="0.5"/>
        <path d="M80 48 L84 46 L86 50 L84 56 L78 54 Z" fill="#9ca3af" stroke="#60a5fa" strokeWidth="0.5"/>
        {/* Legs */}
        <rect x="39" y="65" width="8" height="12" rx="2" fill="#4b5563" stroke="#6b7280" strokeWidth="0.4"/>
        <rect x="53" y="65" width="8" height="12" rx="2" fill="#4b5563" stroke="#6b7280" strokeWidth="0.4"/>
        {/* Circuit lines on body */}
        <line x1="42" y1="55" x2="42" y2="62" stroke="#60a5fa" strokeWidth="0.4" opacity="0.5"/>
        <line x1="58" y1="55" x2="58" y2="62" stroke="#60a5fa" strokeWidth="0.4" opacity="0.5"/>
        <circle cx="42" cy="58" r="0.8" fill="#38bdf8" opacity="0.6"/>
        <circle cx="58" cy="58" r="0.8" fill="#38bdf8" opacity="0.6"/>
        {/* Highlight shimmer */}
        <path d="M40 22 L50 10 L54 10 L42 24 Z" fill="white" opacity="0.06"/>
        {/* Floating particles */}
        <circle cx="14" cy="30" r="0.6" fill="#60a5fa" opacity="0.4"/>
        <circle cx="86" cy="35" r="0.5" fill="#60a5fa" opacity="0.3"/>
        <circle cx="12" cy="60" r="0.4" fill="#38bdf8" opacity="0.3"/>
      </>
    ),
  },
  aufklaerer: {
    bg: 'linear-gradient(180deg, #0f172a 0%, #0c1220 40%, #060a14 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="ak_scan" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15"/><stop offset="100%" stopColor="#0f172a" stopOpacity="0"/></radialGradient>
        </defs>
        {/* Background grid */}
        {[20,30,40,50,60,70].map(y => <line key={`h${y}`} x1="5" y1={y} x2="95" y2={y} stroke="#1e3a5f" strokeWidth="0.3" opacity="0.3"/>)}
        {[15,25,35,45,55,65,75,85].map(x => <line key={`v${x}`} x1={x} y1="8" x2={x} y2="80" stroke="#1e3a5f" strokeWidth="0.3" opacity="0.2"/>)}
        {/* Scan field */}
        <circle cx="50" cy="44" r="32" fill="url(#ak_scan)"/>
        {/* Outer ring */}
        <circle cx="50" cy="44" r="28" fill="none" stroke="#1e40af" strokeWidth="0.5" opacity="0.3" strokeDasharray="3 2"/>
        <circle cx="50" cy="44" r="22" fill="none" stroke="#2563eb" strokeWidth="0.6" opacity="0.4"/>
        {/* Radar sweep */}
        <path d="M50 44 L50 16 A28 28 0 0 1 72 30 Z" fill="#3b82f6" opacity="0.06"/>
        {/* Figure — cloaked scout */}
        <path d="M44 28 L50 22 L56 28 L58 38 Q58 48 56 55 L50 58 L44 55 Q42 48 42 38 Z" fill="#1e293b" stroke="#334155" strokeWidth="0.6"/>
        {/* Hood */}
        <path d="M43 32 Q46 20 50 18 Q54 20 57 32 Z" fill="#0f172a" stroke="#475569" strokeWidth="0.5"/>
        {/* Face visor */}
        <path d="M45 28 L55 28 L54 32 L46 32 Z" fill="#0c4a6e"/>
        <line x1="46" y1="29.5" x2="54" y2="29.5" stroke="#38bdf8" strokeWidth="0.8" opacity="0.9"/>
        <line x1="47" y1="31" x2="53" y2="31" stroke="#3b82f6" strokeWidth="0.5" opacity="0.6"/>
        {/* Chest scanner device */}
        <rect x="47" y="35" width="6" height="4" rx="0.5" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="0.4"/>
        <circle cx="50" cy="37" r="1" fill="#60a5fa"/>
        <circle cx="50" cy="37" r="0.4" fill="white"/>
        {/* Scanning arm */}
        <path d="M58 36 L68 30 L72 32 L70 34 L62 38 Z" fill="#334155" stroke="#475569" strokeWidth="0.3"/>
        <circle cx="71" cy="31" r="2" fill="#0c4a6e" stroke="#38bdf8" strokeWidth="0.5"/>
        <circle cx="71" cy="31" r="0.8" fill="#60a5fa"/>
        {/* Holographic display */}
        <rect x="68" y="22" width="16" height="10" rx="1" fill="#0f172a" stroke="#3b82f6" strokeWidth="0.4" opacity="0.7"/>
        <line x1="70" y1="24" x2="82" y2="24" stroke="#60a5fa" strokeWidth="0.3" opacity="0.5"/>
        <line x1="70" y1="26" x2="78" y2="26" stroke="#60a5fa" strokeWidth="0.3" opacity="0.4"/>
        <line x1="70" y1="28" x2="80" y2="28" stroke="#60a5fa" strokeWidth="0.3" opacity="0.3"/>
        <rect x="75" y="24" width="3" height="3" rx="0.3" fill="#3b82f6" opacity="0.2"/>
        {/* Crosshair markers */}
        <path d="M18 20 L18 14 L24 14" fill="none" stroke="#475569" strokeWidth="1"/>
        <path d="M82 20 L82 14 L76 14" fill="none" stroke="#475569" strokeWidth="1"/>
        <path d="M18 70 L18 76 L24 76" fill="none" stroke="#475569" strokeWidth="1"/>
        <path d="M82 70 L82 76 L76 76" fill="none" stroke="#475569" strokeWidth="1"/>
        {/* Data particles */}
        <circle cx="25" cy="22" r="0.6" fill="#3b82f6" opacity="0.5"/>
        <circle cx="30" cy="55" r="0.5" fill="#60a5fa" opacity="0.3"/>
        <circle cx="75" cy="60" r="0.6" fill="#3b82f6" opacity="0.4"/>
        <circle cx="20" cy="45" r="0.4" fill="#93c5fd" opacity="0.3"/>
        {/* Center reticle */}
        <circle cx="50" cy="44" r="6" fill="none" stroke="#3b82f6" strokeWidth="0.5" opacity="0.5"/>
        <line x1="50" y1="36" x2="50" y2="40" stroke="#60a5fa" strokeWidth="0.4" opacity="0.4"/>
        <line x1="50" y1="48" x2="50" y2="52" stroke="#60a5fa" strokeWidth="0.4" opacity="0.4"/>
        <line x1="42" y1="44" x2="46" y2="44" stroke="#60a5fa" strokeWidth="0.4" opacity="0.4"/>
        <line x1="54" y1="44" x2="58" y2="44" stroke="#60a5fa" strokeWidth="0.4" opacity="0.4"/>
      </>
    ),
  },
  skelett_horde: {
    bg: 'linear-gradient(180deg, #1a2e1a 0%, #0f1a0f 40%, #050d05 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="sh_fog" cx="50%" cy="80%" r="60%"><stop offset="0%" stopColor="#22c55e" stopOpacity="0.1"/><stop offset="100%" stopColor="#052e16" stopOpacity="0"/></radialGradient>
        </defs>
        {/* Eerie ground fog */}
        <ellipse cx="50" cy="75" rx="45" ry="10" fill="url(#sh_fog)"/>
        <ellipse cx="30" cy="78" rx="20" ry="5" fill="#22c55e" opacity="0.04"/>
        <ellipse cx="70" cy="76" rx="18" ry="4" fill="#22c55e" opacity="0.03"/>
        {/* Background tombstone */}
        <rect x="78" y="50" width="8" height="14" rx="3" fill="#1a2e1a" stroke="#2a3a2a" strokeWidth="0.4" opacity="0.5"/>
        <rect x="12" y="55" width="6" height="10" rx="2" fill="#1a2e1a" stroke="#2a3a2a" strokeWidth="0.4" opacity="0.4"/>
        {/* Central skull — large, detailed */}
        <path d="M36 25 Q36 12 50 10 Q64 12 64 25 L64 38 Q64 44 58 46 L56 48 L44 48 L42 46 Q36 44 36 38 Z" fill="#d4d4d8" stroke="#a1a1aa" strokeWidth="0.5"/>
        <path d="M38 24 Q38 14 50 12 Q62 14 62 24 L62 36 Q62 42 57 44 L43 44 Q38 42 38 36 Z" fill="#e5e5e5"/>
        {/* Eye sockets — deep */}
        <ellipse cx="44" cy="28" rx="5" ry="5.5" fill="#0f1a0f"/>
        <ellipse cx="56" cy="28" rx="5" ry="5.5" fill="#0f1a0f"/>
        {/* Glowing eyes */}
        <circle cx="44" cy="28" r="2" fill="#22c55e" opacity="0.7"/>
        <circle cx="56" cy="28" r="2" fill="#22c55e" opacity="0.7"/>
        <circle cx="44" cy="28" r="0.8" fill="#86efac"/>
        <circle cx="56" cy="28" r="0.8" fill="#86efac"/>
        {/* Nose cavity */}
        <path d="M48 34 L50 31 L52 34 Z" fill="#1a2e1a"/>
        {/* Teeth */}
        <path d="M43 40 L45 38 L47 40 L49 38 L51 40 L53 38 L55 40 L57 38" fill="none" stroke="#a1a1aa" strokeWidth="1"/>
        <rect x="44" y="38" width="2.5" height="4" rx="0.3" fill="#d4d4d8"/>
        <rect x="47.5" y="38" width="2.5" height="4.5" rx="0.3" fill="#d4d4d8"/>
        <rect x="50.5" y="38" width="2.5" height="4" rx="0.3" fill="#d4d4d8"/>
        <rect x="53.5" y="38" width="2.5" height="3.5" rx="0.3" fill="#d4d4d8"/>
        {/* Crack detail */}
        <path d="M42 18 L44 22 L42 26" fill="none" stroke="#a1a1aa" strokeWidth="0.5" opacity="0.6"/>
        <path d="M58 20 L56 24" fill="none" stroke="#a1a1aa" strokeWidth="0.4" opacity="0.5"/>
        {/* Left background skull */}
        <path d="M14 42 Q14 34 24 33 Q34 34 34 42 L34 48 Q32 52 24 52 Q16 52 14 48 Z" fill="#b8b8c0" opacity="0.5"/>
        <circle cx="20" cy="40" r="2.5" fill="#0f1a0f" opacity="0.6"/>
        <circle cx="28" cy="40" r="2.5" fill="#0f1a0f" opacity="0.6"/>
        <circle cx="20" cy="40" r="1" fill="#22c55e" opacity="0.3"/>
        <circle cx="28" cy="40" r="1" fill="#22c55e" opacity="0.3"/>
        {/* Right background skull */}
        <path d="M66 42 Q66 34 76 33 Q86 34 86 42 L86 48 Q84 52 76 52 Q68 52 66 48 Z" fill="#b8b8c0" opacity="0.5"/>
        <circle cx="72" cy="40" r="2.5" fill="#0f1a0f" opacity="0.6"/>
        <circle cx="80" cy="40" r="2.5" fill="#0f1a0f" opacity="0.6"/>
        <circle cx="72" cy="40" r="1" fill="#22c55e" opacity="0.3"/>
        <circle cx="80" cy="40" r="1" fill="#22c55e" opacity="0.3"/>
        {/* Bones underneath */}
        <path d="M30 60 Q38 56 46 60 Q50 62 54 60 Q62 56 70 60" fill="none" stroke="#d4d4d8" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
        <path d="M35 66 L65 66" stroke="#d4d4d8" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
        <circle cx="33" cy="66" r="2.5" fill="#d4d4d8" opacity="0.3"/>
        <circle cx="67" cy="66" r="2.5" fill="#d4d4d8" opacity="0.3"/>
        {/* Soul wisps */}
        <path d="M38 15 Q35 8 30 6" fill="none" stroke="#22c55e" strokeWidth="0.5" opacity="0.3"/>
        <path d="M62 15 Q65 8 70 6" fill="none" stroke="#22c55e" strokeWidth="0.5" opacity="0.3"/>
        <circle cx="30" cy="6" r="1" fill="#22c55e" opacity="0.2"/>
      </>
    ),
  },
  druidin: {
    bg: 'linear-gradient(180deg, #064e3b 0%, #052e16 50%, #021a0b 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="dr_aura" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#10b981" stopOpacity="0.25"/><stop offset="70%" stopColor="#059669" stopOpacity="0.05"/><stop offset="100%" stopColor="#064e3b" stopOpacity="0"/></radialGradient>
        </defs>
        {/* Nature aura */}
        <circle cx="50" cy="42" r="35" fill="url(#dr_aura)"/>
        {/* Ground vegetation */}
        <path d="M10 72 Q15 65 20 72 Q25 66 30 72 Q35 67 40 73 Q45 68 50 73 Q55 68 60 73 Q65 67 70 72 Q75 66 80 72 Q85 65 90 72" fill="none" stroke="#059669" strokeWidth="1" opacity="0.3"/>
        <path d="M15 76 Q20 70 25 76 Q30 71 35 76 Q40 72 45 77 Q50 72 55 77 Q60 72 65 76 Q70 71 75 76 Q80 70 85 76" fill="none" stroke="#047857" strokeWidth="0.8" opacity="0.2"/>
        {/* Vine circle frame */}
        <circle cx="50" cy="40" r="28" fill="none" stroke="#10b981" strokeWidth="0.6" opacity="0.2"/>
        <circle cx="50" cy="40" r="24" fill="none" stroke="#34d399" strokeWidth="0.4" opacity="0.15"/>
        {/* Figure — hooded druid */}
        <path d="M40 30 Q44 16 50 14 Q56 16 60 30 L62 50 Q62 58 56 62 L44 62 Q38 58 38 50 Z" fill="#065f46" stroke="#059669" strokeWidth="0.5"/>
        {/* Hood */}
        <path d="M42 32 Q44 18 50 16 Q56 18 58 32 Q55 34 50 35 Q45 34 42 32 Z" fill="#052e16" stroke="#059669" strokeWidth="0.4"/>
        {/* Face — emerald glow */}
        <ellipse cx="50" cy="28" rx="6" ry="5" fill="#042f2e"/>
        <circle cx="47" cy="27" r="1.5" fill="#34d399" opacity="0.8"/>
        <circle cx="53" cy="27" r="1.5" fill="#34d399" opacity="0.8"/>
        <circle cx="47" cy="27" r="0.5" fill="#a7f3d0"/>
        <circle cx="53" cy="27" r="0.5" fill="#a7f3d0"/>
        {/* Staff */}
        <line x1="68" y1="12" x2="68" y2="72" stroke="#78716c" strokeWidth="1.5"/>
        <line x1="68" y1="12" x2="68" y2="72" stroke="#92400e" strokeWidth="0.8"/>
        {/* Staff crystal */}
        <polygon points="68,8 72,14 68,20 64,14" fill="#10b981" stroke="#34d399" strokeWidth="0.5"/>
        <polygon points="68,10 70,14 68,18 66,14" fill="#34d399" opacity="0.6"/>
        <circle cx="68" cy="14" r="1.5" fill="#a7f3d0" opacity="0.8"/>
        {/* Hands reaching to crystal */}
        <path d="M58 42 Q62 38 66 34" fill="none" stroke="#065f46" strokeWidth="2" strokeLinecap="round"/>
        {/* Growing vines around staff */}
        <path d="M68 25 Q72 28 70 32 Q68 36 72 40 Q70 44 68 48" fill="none" stroke="#10b981" strokeWidth="0.6" opacity="0.5"/>
        <circle cx="72" cy="28" r="1.5" fill="#059669" opacity="0.4"/>
        <circle cx="72" cy="40" r="1.5" fill="#059669" opacity="0.4"/>
        {/* Floating petal effects */}
        <ellipse cx="28" cy="22" rx="2" ry="1" fill="#34d399" opacity="0.4" transform="rotate(-30 28 22)"/>
        <ellipse cx="75" cy="50" rx="1.5" ry="0.8" fill="#34d399" opacity="0.3" transform="rotate(20 75 50)"/>
        <ellipse cx="22" cy="55" rx="1.5" ry="0.8" fill="#10b981" opacity="0.3" transform="rotate(-15 22 55)"/>
        {/* Fireflies */}
        <circle cx="18" cy="30" r="0.8" fill="#a7f3d0" opacity="0.6"/>
        <circle cx="82" cy="25" r="0.6" fill="#a7f3d0" opacity="0.4"/>
        <circle cx="15" cy="58" r="0.6" fill="#6ee7b7" opacity="0.5"/>
        <circle cx="85" cy="55" r="0.7" fill="#6ee7b7" opacity="0.4"/>
        <circle cx="35" cy="12" r="0.5" fill="#a7f3d0" opacity="0.3"/>
      </>
    ),
  },
  hermes: {
    bg: 'linear-gradient(180deg, #451a03 0%, #371505 40%, #1a0a02 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="hm_glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15"/><stop offset="100%" stopColor="#451a03" stopOpacity="0"/></radialGradient>
        </defs>
        {/* Golden aura */}
        <circle cx="50" cy="40" r="32" fill="url(#hm_glow)"/>
        {/* Speed lines background */}
        <line x1="0" y1="30" x2="20" y2="32" stroke="#fbbf24" strokeWidth="0.4" opacity="0.15"/>
        <line x1="0" y1="45" x2="18" y2="44" stroke="#fbbf24" strokeWidth="0.3" opacity="0.1"/>
        <line x1="0" y1="55" x2="15" y2="56" stroke="#d97706" strokeWidth="0.3" opacity="0.1"/>
        <line x1="80" y1="28" x2="100" y2="30" stroke="#fbbf24" strokeWidth="0.4" opacity="0.15"/>
        <line x1="82" y1="50" x2="100" y2="48" stroke="#fbbf24" strokeWidth="0.3" opacity="0.1"/>
        {/* Winged helmet */}
        <ellipse cx="50" cy="30" rx="12" ry="10" fill="#d97706" stroke="#f59e0b" strokeWidth="0.5"/>
        <ellipse cx="50" cy="32" rx="10" ry="6" fill="#b45309"/>
        {/* Helmet crest */}
        <path d="M44 22 L50 16 L56 22" fill="none" stroke="#fbbf24" strokeWidth="1"/>
        <path d="M47 20 L50 17 L53 20" fill="#f59e0b"/>
        {/* Left wing — detailed feathers */}
        <path d="M38 28 Q28 18 16 14 Q20 20 22 24" fill="none" stroke="#fbbf24" strokeWidth="1.2"/>
        <path d="M38 30 Q30 22 20 20 Q24 26 26 28" fill="none" stroke="#f59e0b" strokeWidth="1"/>
        <path d="M38 32 Q32 26 24 26 Q28 30 30 32" fill="none" stroke="#d97706" strokeWidth="0.8"/>
        <path d="M16 14 Q14 12 10 12 Q13 16 16 18" fill="#fbbf24" opacity="0.7"/>
        <path d="M20 20 Q16 18 12 19 Q16 22 20 23" fill="#f59e0b" opacity="0.6"/>
        <path d="M24 26 Q20 25 17 27 Q20 29 24 29" fill="#d97706" opacity="0.5"/>
        {/* Right wing */}
        <path d="M62 28 Q72 18 84 14 Q80 20 78 24" fill="none" stroke="#fbbf24" strokeWidth="1.2"/>
        <path d="M62 30 Q70 22 80 20 Q76 26 74 28" fill="none" stroke="#f59e0b" strokeWidth="1"/>
        <path d="M62 32 Q68 26 76 26 Q72 30 70 32" fill="none" stroke="#d97706" strokeWidth="0.8"/>
        <path d="M84 14 Q86 12 90 12 Q87 16 84 18" fill="#fbbf24" opacity="0.7"/>
        <path d="M80 20 Q84 18 88 19 Q84 22 80 23" fill="#f59e0b" opacity="0.6"/>
        <path d="M76 26 Q80 25 83 27 Q80 29 76 29" fill="#d97706" opacity="0.5"/>
        {/* Face */}
        <ellipse cx="50" cy="34" rx="7" ry="6" fill="#92400e"/>
        <circle cx="47" cy="33" r="1.5" fill="#fef3c7" opacity="0.8"/>
        <circle cx="53" cy="33" r="1.5" fill="#fef3c7" opacity="0.8"/>
        <circle cx="47" cy="33" r="0.6" fill="#78350f"/>
        <circle cx="53" cy="33" r="0.6" fill="#78350f"/>
        {/* Body — running pose */}
        <path d="M44 40 L42 50 L38 58 L36 66 L40 66 L44 58 L46 52 L50 48 L54 52 L56 58 L60 66 L64 66 L62 58 L58 50 L56 40 Z" fill="#d97706" stroke="#b45309" strokeWidth="0.4"/>
        {/* Sandals with wing detail */}
        <path d="M36 66 L34 70 L42 70 L40 66" fill="#b45309"/>
        <path d="M60 66 L58 70 L66 70 L64 66" fill="#b45309"/>
        <path d="M34 68 Q30 65 28 66 Q30 70 34 70" fill="#fbbf24" opacity="0.5"/>
        <path d="M66 68 Q70 65 72 66 Q70 70 66 70" fill="#fbbf24" opacity="0.5"/>
        {/* Caduceus staff */}
        <line x1="30" y1="38" x2="22" y2="16" stroke="#a16207" strokeWidth="1.2"/>
        <circle cx="22" cy="14" r="2.5" fill="#f59e0b" opacity="0.6"/>
        <path d="M20 22 Q16 18 22 14 Q28 18 24 22 Q20 26 22 28" fill="none" stroke="#fbbf24" strokeWidth="0.6" opacity="0.6"/>
        {/* Motion blur particles */}
        <circle cx="26" cy="60" r="0.8" fill="#fbbf24" opacity="0.3"/>
        <circle cx="74" cy="58" r="0.6" fill="#fbbf24" opacity="0.2"/>
        <circle cx="20" cy="50" r="0.5" fill="#f59e0b" opacity="0.2"/>
      </>
    ),
  },
  verzauberin: {
    bg: 'linear-gradient(180deg, #042f2e 0%, #021f1e 40%, #010f0e 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="vz_aura" cx="50%" cy="45%" r="50%"><stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.15"/><stop offset="100%" stopColor="#042f2e" stopOpacity="0"/></radialGradient>
        </defs>
        <circle cx="50" cy="42" r="35" fill="url(#vz_aura)"/>
        {/* Magic circles on ground */}
        <ellipse cx="50" cy="68" rx="30" ry="6" fill="none" stroke="#14b8a6" strokeWidth="0.4" opacity="0.3"/>
        <ellipse cx="50" cy="68" rx="22" ry="4.5" fill="none" stroke="#2dd4bf" strokeWidth="0.3" opacity="0.2"/>
        {/* Figure — enchantress with flowing robe */}
        <path d="M42 26 Q46 18 50 16 Q54 18 58 26 L60 42 L64 65 Q58 70 50 72 Q42 70 36 65 L40 42 Z" fill="#0f766e" stroke="#14b8a6" strokeWidth="0.4"/>
        <path d="M42 26 Q46 18 50 16 Q54 18 58 26 L56 30 Q53 32 50 33 Q47 32 44 30 Z" fill="#064e3b"/>
        {/* Face */}
        <ellipse cx="50" cy="24" rx="5" ry="4.5" fill="#0d9488"/>
        <circle cx="48" cy="23" r="1.2" fill="#5eead4" opacity="0.9"/>
        <circle cx="52" cy="23" r="1.2" fill="#5eead4" opacity="0.9"/>
        <circle cx="48" cy="23" r="0.4" fill="#ccfbf1"/>
        <circle cx="52" cy="23" r="0.4" fill="#ccfbf1"/>
        {/* Tiara */}
        <path d="M44 20 L46 16 L48 19 L50 14 L52 19 L54 16 L56 20" fill="none" stroke="#2dd4bf" strokeWidth="0.8"/>
        <circle cx="50" cy="14" r="1.5" fill="#5eead4" opacity="0.7"/>
        {/* Left hand — casting orb */}
        <path d="M40 38 Q34 34 28 32" fill="none" stroke="#0f766e" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="25" cy="30" r="6" fill="#042f2e" stroke="#2dd4bf" strokeWidth="0.8"/>
        <circle cx="25" cy="30" r="4" fill="#0d9488" opacity="0.5"/>
        <circle cx="25" cy="30" r="2" fill="#2dd4bf" opacity="0.7"/>
        <circle cx="25" cy="30" r="0.8" fill="#ccfbf1"/>
        {/* Orb energy lines */}
        <path d="M20 26 Q22 28 23 30" fill="none" stroke="#5eead4" strokeWidth="0.4" opacity="0.5"/>
        <path d="M30 34 Q28 32 27 30" fill="none" stroke="#5eead4" strokeWidth="0.4" opacity="0.5"/>
        {/* Right hand — casting orb */}
        <path d="M60 38 Q66 34 72 32" fill="none" stroke="#0f766e" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="75" cy="30" r="6" fill="#042f2e" stroke="#34d399" strokeWidth="0.8"/>
        <circle cx="75" cy="30" r="4" fill="#059669" opacity="0.5"/>
        <circle cx="75" cy="30" r="2" fill="#34d399" opacity="0.7"/>
        <circle cx="75" cy="30" r="0.8" fill="#a7f3d0"/>
        {/* Energy stream between orbs */}
        <path d="M31 30 Q40 22 50 24 Q60 22 69 30" fill="none" stroke="#5eead4" strokeWidth="0.6" opacity="0.4" strokeDasharray="2 1.5"/>
        <path d="M31 30 Q42 38 50 36 Q58 38 69 30" fill="none" stroke="#6ee7b7" strokeWidth="0.5" opacity="0.3" strokeDasharray="2 1.5"/>
        {/* Robe details — flowing edges */}
        <path d="M36 65 Q32 60 30 68 Q28 72 32 72" fill="#0d9488" opacity="0.3"/>
        <path d="M64 65 Q68 60 70 68 Q72 72 68 72" fill="#0d9488" opacity="0.3"/>
        {/* Swirling particles */}
        <circle cx="35" cy="20" r="0.7" fill="#99f6e4" opacity="0.5"/>
        <circle cx="65" cy="18" r="0.6" fill="#99f6e4" opacity="0.4"/>
        <circle cx="15" cy="45" r="0.5" fill="#5eead4" opacity="0.3"/>
        <circle cx="85" cy="42" r="0.5" fill="#6ee7b7" opacity="0.3"/>
        <circle cx="50" cy="8" r="0.6" fill="#a7f3d0" opacity="0.3"/>
        <circle cx="40" cy="75" r="0.4" fill="#2dd4bf" opacity="0.2"/>
      </>
    ),
  },
  hydra: {
    bg: 'linear-gradient(180deg, #3b0f0f 0%, #2a0a1a 40%, #150510 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="hy_heat" cx="50%" cy="80%" r="50%"><stop offset="0%" stopColor="#ef4444" stopOpacity="0.15"/><stop offset="100%" stopColor="#3b0f0f" stopOpacity="0"/></radialGradient>
        </defs>
        <ellipse cx="50" cy="75" rx="35" ry="8" fill="url(#hy_heat)"/>
        {/* Body mass */}
        <path d="M35 72 Q30 62 32 55 Q34 48 38 45 Q42 42 46 40 L50 38 L54 40 Q58 42 62 45 Q66 48 68 55 Q70 62 65 72 Z" fill="#7f1d1d" stroke="#991b1b" strokeWidth="0.5"/>
        <path d="M38 70 Q35 64 37 58 Q39 52 44 48 L50 44 L56 48 Q61 52 63 58 Q65 64 62 70" fill="#991b1b"/>
        {/* Scales texture */}
        <path d="M40 55 Q42 53 44 55 Q46 53 48 55 Q50 53 52 55 Q54 53 56 55 Q58 53 60 55" fill="none" stroke="#b91c1c" strokeWidth="0.4" opacity="0.5"/>
        <path d="M42 60 Q44 58 46 60 Q48 58 50 60 Q52 58 54 60 Q56 58 58 60" fill="none" stroke="#b91c1c" strokeWidth="0.4" opacity="0.4"/>
        {/* Left neck */}
        <path d="M42 45 Q36 38 28 32 Q22 28 18 22" fill="none" stroke="#991b1b" strokeWidth="4.5" strokeLinecap="round"/>
        <path d="M42 45 Q36 38 28 32 Q22 28 18 22" fill="none" stroke="#b91c1c" strokeWidth="3" strokeLinecap="round"/>
        {/* Left head */}
        <ellipse cx="15" cy="18" rx="9" ry="7" fill="#dc2626" transform="rotate(-25 15 18)"/>
        <ellipse cx="15" cy="18" rx="7" ry="5" fill="#ef4444" transform="rotate(-25 15 18)"/>
        <circle cx="12" cy="15" r="2" fill="#fbbf24"/>
        <circle cx="12" cy="15" r="0.8" fill="#422006"/>
        <path d="M8 22 L4 26 M8 22 L3 23 M8 22 L5 28" stroke="#ef4444" strokeWidth="0.8" strokeLinecap="round"/>
        {/* Teeth left */}
        <path d="M10 22 L9 24 M12 23 L12 25 M14 23 L15 25" stroke="#fef3c7" strokeWidth="0.5"/>
        {/* Center neck */}
        <path d="M50 40 Q50 32 50 24 Q50 18 50 14" fill="none" stroke="#991b1b" strokeWidth="5" strokeLinecap="round"/>
        <path d="M50 40 Q50 32 50 24 Q50 18 50 14" fill="none" stroke="#b91c1c" strokeWidth="3.5" strokeLinecap="round"/>
        {/* Center head — largest */}
        <ellipse cx="50" cy="10" rx="10" ry="8" fill="#dc2626"/>
        <ellipse cx="50" cy="10" rx="8" ry="6" fill="#ef4444"/>
        <circle cx="46" cy="8" r="2.2" fill="#fbbf24"/>
        <circle cx="54" cy="8" r="2.2" fill="#fbbf24"/>
        <circle cx="46" cy="8" r="0.9" fill="#422006"/>
        <circle cx="54" cy="8" r="0.9" fill="#422006"/>
        <path d="M46 14 L44 18 M48 15 L48 18 M50 15 L50 19 M52 15 L52 18 M54 14 L56 18" stroke="#ef4444" strokeWidth="0.8" strokeLinecap="round"/>
        <path d="M47 14 L46 16 M49 15 L49 17 M51 15 L51 17 M53 14 L54 16" stroke="#fef3c7" strokeWidth="0.4"/>
        {/* Right neck */}
        <path d="M58 45 Q64 38 72 32 Q78 28 82 22" fill="none" stroke="#991b1b" strokeWidth="4.5" strokeLinecap="round"/>
        <path d="M58 45 Q64 38 72 32 Q78 28 82 22" fill="none" stroke="#b91c1c" strokeWidth="3" strokeLinecap="round"/>
        {/* Right head */}
        <ellipse cx="85" cy="18" rx="9" ry="7" fill="#dc2626" transform="rotate(25 85 18)"/>
        <ellipse cx="85" cy="18" rx="7" ry="5" fill="#ef4444" transform="rotate(25 85 18)"/>
        <circle cx="88" cy="15" r="2" fill="#fbbf24"/>
        <circle cx="88" cy="15" r="0.8" fill="#422006"/>
        <path d="M92 22 L96 26 M92 22 L97 23 M92 22 L95 28" stroke="#ef4444" strokeWidth="0.8" strokeLinecap="round"/>
        {/* Smoke/steam wisps */}
        <path d="M15 12 Q12 6 14 2" fill="none" stroke="#fca5a5" strokeWidth="0.5" opacity="0.3"/>
        <path d="M50 4 Q48 0 50 -3" fill="none" stroke="#fca5a5" strokeWidth="0.5" opacity="0.3"/>
        <path d="M85 12 Q88 6 86 2" fill="none" stroke="#fca5a5" strokeWidth="0.5" opacity="0.3"/>
        {/* Belly glow */}
        <ellipse cx="50" cy="58" rx="8" ry="5" fill="#f87171" opacity="0.08"/>
      </>
    ),
  },
  leerenmagier: {
    bg: 'linear-gradient(180deg, #1e1b4b 0%, #0f0a2e 50%, #050218 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="vm_void" cx="50%" cy="45%" r="35%"><stop offset="0%" stopColor="#020010"/><stop offset="60%" stopColor="#0f0526"/><stop offset="100%" stopColor="#1e1b4b" stopOpacity="0"/></radialGradient>
          <radialGradient id="vm_outer" cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="#7c3aed" stopOpacity="0.1"/><stop offset="100%" stopColor="#1e1b4b" stopOpacity="0"/></radialGradient>
        </defs>
        <circle cx="50" cy="42" r="36" fill="url(#vm_outer)"/>
        {/* Void portal */}
        <circle cx="50" cy="42" r="18" fill="url(#vm_void)" stroke="#6d28d9" strokeWidth="0.8"/>
        <circle cx="50" cy="42" r="14" fill="#050218" stroke="#7c3aed" strokeWidth="0.5" opacity="0.6"/>
        <circle cx="50" cy="42" r="9" fill="#020010"/>
        {/* Spiral arms inside void */}
        <path d="M50 42 Q55 36 58 38 Q60 42 56 46 Q50 48 46 44 Q44 38 48 34 Q54 32 60 36" fill="none" stroke="#a78bfa" strokeWidth="0.4" opacity="0.3"/>
        <path d="M50 42 Q45 48 42 46 Q40 42 44 38 Q50 36 54 40 Q56 46 52 50 Q46 52 40 48" fill="none" stroke="#8b5cf6" strokeWidth="0.3" opacity="0.2"/>
        {/* Robed figure emerging */}
        <path d="M42 28 Q46 18 50 15 Q54 18 58 28 L60 55 Q58 65 50 68 Q42 65 40 55 Z" fill="#1e1b4b" stroke="#4c1d95" strokeWidth="0.4" opacity="0.8"/>
        {/* Hood */}
        <path d="M43 30 Q46 20 50 17 Q54 20 57 30 Q54 33 50 34 Q46 33 43 30 Z" fill="#0f0a2e" stroke="#6d28d9" strokeWidth="0.3"/>
        {/* Void eyes */}
        <ellipse cx="47" cy="26" rx="2.5" ry="1.5" fill="#020010"/>
        <ellipse cx="53" cy="26" rx="2.5" ry="1.5" fill="#020010"/>
        <circle cx="47" cy="26" r="1" fill="#a78bfa" opacity="0.8"/>
        <circle cx="53" cy="26" r="1" fill="#a78bfa" opacity="0.8"/>
        <circle cx="47" cy="26" r="0.3" fill="white" opacity="0.6"/>
        <circle cx="53" cy="26" r="0.3" fill="white" opacity="0.6"/>
        {/* Hands reaching out controlling void */}
        <path d="M40 40 Q34 36 28 34" fill="none" stroke="#4c1d95" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M60 40 Q66 36 72 34" fill="none" stroke="#4c1d95" strokeWidth="1.5" strokeLinecap="round"/>
        {/* Energy streams into void */}
        <path d="M10 15 Q25 25 36 36" fill="none" stroke="#a78bfa" strokeWidth="0.6" opacity="0.4"/>
        <path d="M90 15 Q75 25 64 36" fill="none" stroke="#a78bfa" strokeWidth="0.6" opacity="0.4"/>
        <path d="M8 65 Q25 55 38 48" fill="none" stroke="#8b5cf6" strokeWidth="0.5" opacity="0.3"/>
        <path d="M92 65 Q75 55 62 48" fill="none" stroke="#8b5cf6" strokeWidth="0.5" opacity="0.3"/>
        <path d="M50 5 Q50 18 50 28" fill="none" stroke="#c4b5fd" strokeWidth="0.4" opacity="0.25"/>
        <path d="M50 80 Q50 65 50 56" fill="none" stroke="#c4b5fd" strokeWidth="0.4" opacity="0.25"/>
        {/* Floating debris being sucked in */}
        <rect x="16" cy="22" y="20" width="3" height="2" rx="0.3" fill="#a78bfa" opacity="0.3" transform="rotate(15 17 21)"/>
        <rect x="80" y="24" width="2.5" height="1.5" rx="0.3" fill="#8b5cf6" opacity="0.25" transform="rotate(-20 81 25)"/>
        <circle cx="22" cy="55" r="1" fill="#a78bfa" opacity="0.2"/>
        <circle cx="78" cy="58" r="0.8" fill="#8b5cf6" opacity="0.2"/>
        {/* Arcane runes ring */}
        <circle cx="50" cy="42" r="24" fill="none" stroke="#7c3aed" strokeWidth="0.3" opacity="0.2" strokeDasharray="4 3 1 3"/>
        <circle cx="50" cy="42" r="30" fill="none" stroke="#6d28d9" strokeWidth="0.2" opacity="0.1" strokeDasharray="2 4"/>
      </>
    ),
  },
  assassine: {
    bg: 'linear-gradient(180deg, #1c1917 0%, #0f0d0c 40%, #060504 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="as_shadow" cx="50%" cy="55%" r="50%"><stop offset="0%" stopColor="#000" stopOpacity="0.3"/><stop offset="100%" stopColor="#1c1917" stopOpacity="0"/></radialGradient>
        </defs>
        <circle cx="50" cy="50" r="35" fill="url(#as_shadow)"/>
        {/* Moonlight streak */}
        <path d="M75 0 L55 85" stroke="white" strokeWidth="15" opacity="0.015"/>
        {/* Shadow figure — crouching assassin */}
        <path d="M46 24 Q48 18 50 16 Q52 18 54 24 L56 30 Q58 34 60 36 L62 42 L58 52 L56 58 Q54 62 50 64 Q46 62 44 58 L42 52 L38 42 L40 36 Q42 34 44 30 Z" fill="#292524" stroke="#3f3f46" strokeWidth="0.3"/>
        {/* Hood — deep shadow */}
        <path d="M45 26 Q48 18 50 16 Q52 18 55 26 Q53 28 50 29 Q47 28 45 26 Z" fill="#0f0d0c"/>
        {/* Eyes — only glint visible */}
        <line x1="47" y1="23" x2="49" y2="23" stroke="#dc2626" strokeWidth="0.8" strokeLinecap="round"/>
        <line x1="51" y1="23" x2="53" y2="23" stroke="#dc2626" strokeWidth="0.8" strokeLinecap="round"/>
        {/* Mask/face wrap */}
        <path d="M46 25 L50 27 L54 25" fill="none" stroke="#44403c" strokeWidth="0.5"/>
        {/* Blade — main weapon — long detailed dagger */}
        <path d="M66 14 L68 12 L70 14 L68 58 L67 60 L66 58 Z" fill="#a1a1aa" stroke="#d4d4d8" strokeWidth="0.3"/>
        <path d="M67 14 L68 12 L68.5 14 L68 56 L67.5 56 Z" fill="#d4d4d8" opacity="0.5"/>
        {/* Blade edge gleam */}
        <line x1="68" y1="16" x2="68" y2="50" stroke="white" strokeWidth="0.3" opacity="0.2"/>
        {/* Crossguard */}
        <path d="M63 58 L73 58 L72 60 L64 60 Z" fill="#78716c" stroke="#a1a1aa" strokeWidth="0.3"/>
        {/* Handle wrap */}
        <rect x="66.5" y="60" width="3" height="8" rx="0.5" fill="#57534e"/>
        <line x1="66.5" y1="62" x2="69.5" y2="62" stroke="#44403c" strokeWidth="0.3"/>
        <line x1="66.5" y1="64" x2="69.5" y2="64" stroke="#44403c" strokeWidth="0.3"/>
        <line x1="66.5" y1="66" x2="69.5" y2="66" stroke="#44403c" strokeWidth="0.3"/>
        {/* Pommel */}
        <circle cx="68" cy="70" r="2" fill="#78716c" stroke="#a1a1aa" strokeWidth="0.3"/>
        <circle cx="68" cy="70" r="0.8" fill="#dc2626" opacity="0.5"/>
        {/* Second blade — off hand */}
        <path d="M30 20 L32 18 L34 20 L32 48 L31 50 L30 48 Z" fill="#9ca3af" stroke="#d4d4d8" strokeWidth="0.2" opacity="0.7"/>
        <path d="M28 48 L36 48 L35 50 L29 50 Z" fill="#78716c" opacity="0.7"/>
        {/* Arm holding blade */}
        <path d="M56 34 Q62 30 66 28 Q68 26 68 22" fill="none" stroke="#292524" strokeWidth="2" strokeLinecap="round"/>
        <path d="M44 34 Q38 30 34 28 Q32 26 32 22" fill="none" stroke="#292524" strokeWidth="2" strokeLinecap="round"/>
        {/* Blood drops on blade */}
        <circle cx="68" cy="30" r="0.8" fill="#dc2626" opacity="0.6"/>
        <path d="M68 32 Q69 34 68 36" fill="none" stroke="#dc2626" strokeWidth="0.5" opacity="0.4"/>
        {/* Ground shadow */}
        <ellipse cx="50" cy="72" rx="22" ry="4" fill="#000" opacity="0.2"/>
        {/* Smoke wisps */}
        <path d="M40 65 Q38 58 36 55" fill="none" stroke="#44403c" strokeWidth="0.4" opacity="0.2"/>
        <path d="M60 65 Q62 58 64 55" fill="none" stroke="#44403c" strokeWidth="0.4" opacity="0.15"/>
      </>
    ),
  },
  paladin: {
    bg: 'linear-gradient(180deg, #422006 0%, #2a1504 40%, #150a02 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="pl_holy" cx="50%" cy="30%" r="50%"><stop offset="0%" stopColor="#fbbf24" stopOpacity="0.2"/><stop offset="100%" stopColor="#422006" stopOpacity="0"/></radialGradient>
          <linearGradient id="pl_shield" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d97706"/><stop offset="100%" stopColor="#78350f"/></linearGradient>
        </defs>
        {/* Holy light rays */}
        <circle cx="50" cy="25" r="35" fill="url(#pl_holy)"/>
        <line x1="50" y1="0" x2="50" y2="20" stroke="#fbbf24" strokeWidth="0.5" opacity="0.15"/>
        <line x1="30" y1="2" x2="40" y2="22" stroke="#fbbf24" strokeWidth="0.4" opacity="0.1"/>
        <line x1="70" y1="2" x2="60" y2="22" stroke="#fbbf24" strokeWidth="0.4" opacity="0.1"/>
        {/* Armored figure */}
        <path d="M40 28 L44 20 L50 18 L56 20 L60 28 L62 42 L64 55 L60 62 L56 66 L50 68 L44 66 L40 62 L36 55 L38 42 Z" fill="#92400e" stroke="#b45309" strokeWidth="0.5"/>
        {/* Helmet */}
        <path d="M42 26 Q44 16 50 14 Q56 16 58 26 L56 30 Q53 32 50 33 Q47 32 44 30 Z" fill="#b45309" stroke="#d97706" strokeWidth="0.5"/>
        {/* Visor slit */}
        <rect x="44" y="24" width="12" height="2" rx="0.5" fill="#422006"/>
        <line x1="45" y1="25" x2="55" y2="25" stroke="#fbbf24" strokeWidth="0.5" opacity="0.4"/>
        {/* Helmet crest */}
        <path d="M50 14 L50 8 L52 10 L50 14" fill="#d97706"/>
        <path d="M50 8 L48 10 L50 14" fill="#f59e0b" opacity="0.5"/>
        {/* Pauldrons */}
        <path d="M38 30 Q32 28 28 30 Q26 34 28 38 L38 36 Z" fill="#b45309" stroke="#d97706" strokeWidth="0.3"/>
        <path d="M62 30 Q68 28 72 30 Q74 34 72 38 L62 36 Z" fill="#b45309" stroke="#d97706" strokeWidth="0.3"/>
        {/* Cross emblem on chest */}
        <rect x="47" y="33" width="6" height="15" rx="0.5" fill="#fbbf24" opacity="0.8"/>
        <rect x="43" y="37" width="14" height="5" rx="0.5" fill="#fbbf24" opacity="0.8"/>
        <rect x="48" y="34" width="4" height="13" rx="0.3" fill="#fef3c7" opacity="0.3"/>
        {/* Shield — large, detailed */}
        <path d="M16 30 L32 24 L32 45 Q32 58 24 64 Q16 58 16 45 Z" fill="url(#pl_shield)" stroke="#fbbf24" strokeWidth="1"/>
        <path d="M20 32 L30 27 L30 44 Q30 54 24 60 Q18 54 18 44 Z" fill="#92400e"/>
        {/* Shield cross */}
        <line x1="24" y1="30" x2="24" y2="56" stroke="#fbbf24" strokeWidth="1.5"/>
        <line x1="19" y1="40" x2="29" y2="40" stroke="#fbbf24" strokeWidth="1.5"/>
        {/* Sword — right hand */}
        <line x1="72" y1="10" x2="72" y2="60" stroke="#a1a1aa" strokeWidth="2"/>
        <line x1="72" y1="10" x2="72" y2="60" stroke="#d4d4d8" strokeWidth="1"/>
        <path d="M72 8 L69 12 L72 11 L75 12 Z" fill="#d4d4d8"/>
        <line x1="68" y1="50" x2="76" y2="50" stroke="#d97706" strokeWidth="2"/>
        <rect x="70.5" y="52" width="3" height="7" rx="0.5" fill="#78350f"/>
        <circle cx="72" cy="60" r="2" fill="#b45309" stroke="#d97706" strokeWidth="0.3"/>
        {/* Arms */}
        <path d="M36 34 Q30 36 26 38" fill="none" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M64 34 Q68 36 72 38" fill="none" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round"/>
        {/* Legs with greaves */}
        <rect x="42" y="62" width="7" height="14" rx="1.5" fill="#b45309" stroke="#d97706" strokeWidth="0.3"/>
        <rect x="51" y="62" width="7" height="14" rx="1.5" fill="#b45309" stroke="#d97706" strokeWidth="0.3"/>
        {/* Cape flowing behind */}
        <path d="M44 30 Q40 45 38 60 Q36 70 34 75" fill="none" stroke="#dc2626" strokeWidth="3" opacity="0.4" strokeLinecap="round"/>
        <path d="M56 30 Q60 45 62 60 Q64 70 66 75" fill="none" stroke="#dc2626" strokeWidth="3" opacity="0.4" strokeLinecap="round"/>
        {/* Ground */}
        <ellipse cx="50" cy="78" rx="25" ry="3" fill="#fbbf24" opacity="0.04"/>
      </>
    ),
  },
  // ── Rares ──
  apollo: {
    bg: 'linear-gradient(180deg, #78350f 0%, #5a2a08 30%, #2a1404 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="ap_sun" cx="50%" cy="40%" r="40%"><stop offset="0%" stopColor="#fef3c7"/><stop offset="30%" stopColor="#fbbf24"/><stop offset="60%" stopColor="#f59e0b"/><stop offset="100%" stopColor="#78350f" stopOpacity="0"/></radialGradient>
          <radialGradient id="ap_halo" cx="50%" cy="40%" r="55%"><stop offset="0%" stopColor="#fbbf24" stopOpacity="0.2"/><stop offset="100%" stopColor="#78350f" stopOpacity="0"/></radialGradient>
        </defs>
        <circle cx="50" cy="38" r="38" fill="url(#ap_halo)"/>
        {/* Sun rays — alternating thick/thin */}
        {[0,30,60,90,120,150,180,210,240,270,300,330].map(a => (
          <line key={a} x1={50+Math.cos(a*Math.PI/180)*18} y1={38+Math.sin(a*Math.PI/180)*18} x2={50+Math.cos(a*Math.PI/180)*38} y2={38+Math.sin(a*Math.PI/180)*38} stroke="#fbbf24" strokeWidth={a%60===0?'2':'0.8'} opacity={a%60===0?'0.5':'0.2'}/>
        ))}
        {/* Sun disc */}
        <circle cx="50" cy="38" r="16" fill="url(#ap_sun)"/>
        <circle cx="50" cy="38" r="12" fill="#fbbf24"/>
        <circle cx="50" cy="38" r="7" fill="#fef3c7" opacity="0.8"/>
        <circle cx="48" cy="36" r="3" fill="white" opacity="0.3"/>
        {/* Figure — Apollo with lyre */}
        <path d="M44 52 Q46 46 50 44 Q54 46 56 52 L58 68 Q54 72 50 73 Q46 72 42 68 Z" fill="#d97706" stroke="#f59e0b" strokeWidth="0.4"/>
        <circle cx="50" cy="42" r="5" fill="#f59e0b"/>
        {/* Laurel crown */}
        <path d="M44 40 Q42 36 44 34 Q46 36 44 40" fill="#22c55e" opacity="0.6"/>
        <path d="M46 38 Q44 34 46 32 Q48 34 46 38" fill="#22c55e" opacity="0.6"/>
        <path d="M56 40 Q58 36 56 34 Q54 36 56 40" fill="#22c55e" opacity="0.6"/>
        <path d="M54 38 Q56 34 54 32 Q52 34 54 38" fill="#22c55e" opacity="0.6"/>
        {/* Eyes */}
        <circle cx="48" cy="41" r="0.8" fill="#422006"/>
        <circle cx="52" cy="41" r="0.8" fill="#422006"/>
        {/* Lyre */}
        <path d="M68 45 Q72 35 70 25 M68 45 Q64 35 66 25" fill="none" stroke="#d97706" strokeWidth="1.2"/>
        <line x1="66" y1="25" x2="70" y2="25" stroke="#f59e0b" strokeWidth="1"/>
        <line x1="67" y1="28" x2="67" y2="42" stroke="#fbbf24" strokeWidth="0.3" opacity="0.6"/>
        <line x1="68" y1="27" x2="68" y2="43" stroke="#fbbf24" strokeWidth="0.3" opacity="0.6"/>
        <line x1="69" y1="28" x2="69" y2="42" stroke="#fbbf24" strokeWidth="0.3" opacity="0.6"/>
        {/* Arm reaching to lyre */}
        <path d="M56 50 Q62 48 66 45" fill="none" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round"/>
        {/* Flowing robe */}
        <path d="M42 68 Q38 72 36 78" fill="none" stroke="#b45309" strokeWidth="1.5" opacity="0.4"/>
        <path d="M58 68 Q62 72 64 78" fill="none" stroke="#b45309" strokeWidth="1.5" opacity="0.4"/>
        {/* Sparkle particles */}
        <circle cx="20" cy="20" r="0.6" fill="#fef3c7" opacity="0.5"/>
        <circle cx="80" cy="22" r="0.5" fill="#fef3c7" opacity="0.4"/>
        <circle cx="15" cy="55" r="0.5" fill="#fbbf24" opacity="0.3"/>
        <circle cx="85" cy="50" r="0.4" fill="#fbbf24" opacity="0.3"/>
      </>
    ),
  },
  greif: {
    bg: 'linear-gradient(180deg, #451a03 0%, #321205 40%, #1a0a02 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="gr_sky" cx="50%" cy="30%" r="60%"><stop offset="0%" stopColor="#78350f" stopOpacity="0.3"/><stop offset="100%" stopColor="#451a03" stopOpacity="0"/></radialGradient>
        </defs>
        <circle cx="50" cy="35" r="38" fill="url(#gr_sky)"/>
        {/* Body — muscular lion */}
        <path d="M30 55 Q28 48 32 42 Q36 38 42 36 L50 34 L58 36 Q64 38 68 42 Q72 48 70 55 Q72 62 68 68 L32 68 Q28 62 30 55 Z" fill="#b45309" stroke="#d97706" strokeWidth="0.4"/>
        <path d="M34 50 Q38 44 46 42 L54 42 Q62 44 66 50" fill="none" stroke="#92400e" strokeWidth="0.4" opacity="0.5"/>
        {/* Fur texture */}
        <path d="M36 52 Q38 50 40 52 Q42 50 44 52" fill="none" stroke="#92400e" strokeWidth="0.4" opacity="0.4"/>
        <path d="M56 52 Q58 50 60 52 Q62 50 64 52" fill="none" stroke="#92400e" strokeWidth="0.4" opacity="0.4"/>
        {/* Eagle head */}
        <path d="M44 30 Q44 18 50 14 Q56 18 56 30 Q53 34 50 35 Q47 34 44 30 Z" fill="#d97706" stroke="#f59e0b" strokeWidth="0.4"/>
        <path d="M46 26 Q48 22 50 20 Q52 22 54 26" fill="#f59e0b" opacity="0.5"/>
        {/* Beak */}
        <path d="M48 28 L50 24 L52 28 L56 30 L52 31 L50 34 L48 31 L44 30 Z" fill="#f59e0b" stroke="#d97706" strokeWidth="0.3"/>
        <path d="M50 26 L52 28 L50 32" fill="#fbbf24" opacity="0.4"/>
        {/* Eagle eyes — fierce */}
        <ellipse cx="46" cy="24" rx="2" ry="1.5" fill="#1c1917"/>
        <ellipse cx="54" cy="24" rx="2" ry="1.5" fill="#1c1917"/>
        <circle cx="46" cy="24" r="0.8" fill="#fbbf24"/>
        <circle cx="54" cy="24" r="0.8" fill="#fbbf24"/>
        <circle cx="46.3" cy="23.8" r="0.3" fill="white"/>
        <circle cx="54.3" cy="23.8" r="0.3" fill="white"/>
        {/* Left wing — spread, detailed feathers */}
        <path d="M30 42 Q18 28 8 18" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M30 44 Q20 32 12 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round"/>
        <path d="M30 46 Q22 36 16 30" fill="none" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round"/>
        {/* Individual feathers left */}
        <path d="M8 18 Q6 16 4 18 Q6 20 10 20" fill="#fbbf24" opacity="0.5"/>
        <path d="M12 24 Q9 22 7 24 Q10 26 14 26" fill="#f59e0b" opacity="0.4"/>
        <path d="M16 30 Q14 28 12 30 Q14 32 18 32" fill="#d97706" opacity="0.4"/>
        {/* Right wing */}
        <path d="M70 42 Q82 28 92 18" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M70 44 Q80 32 88 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round"/>
        <path d="M70 46 Q78 36 84 30" fill="none" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M92 18 Q94 16 96 18 Q94 20 90 20" fill="#fbbf24" opacity="0.5"/>
        <path d="M88 24 Q91 22 93 24 Q90 26 86 26" fill="#f59e0b" opacity="0.4"/>
        {/* Tail — lion */}
        <path d="M30 60 Q22 58 16 62 Q14 66 18 68 Q22 66 24 64" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="16" cy="64" r="3" fill="#d97706"/>
        {/* Front legs — lion paws */}
        <path d="M38 68 L36 76 L40 78 L42 70" fill="#b45309" stroke="#d97706" strokeWidth="0.3"/>
        <path d="M58 68 L60 76 L64 78 L62 70" fill="#b45309" stroke="#d97706" strokeWidth="0.3"/>
        {/* Claws */}
        <path d="M36 76 L34 78 M38 77 L37 79 M40 78 L40 80" stroke="#f59e0b" strokeWidth="0.5"/>
        <path d="M60 76 L59 78 M62 77 L62 79 M64 78 L65 80" stroke="#f59e0b" strokeWidth="0.5"/>
        {/* Wind streaks */}
        <line x1="5" y1="12" x2="12" y2="14" stroke="#fbbf24" strokeWidth="0.3" opacity="0.2"/>
        <line x1="88" y1="14" x2="95" y2="12" stroke="#fbbf24" strokeWidth="0.3" opacity="0.2"/>
      </>
    ),
  },
  energiekern: {
    bg: 'linear-gradient(180deg, #0c4a6e 0%, #062c42 40%, #021420 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="ek_core" cx="50%" cy="45%" r="25%"><stop offset="0%" stopColor="#bae6fd"/><stop offset="30%" stopColor="#38bdf8"/><stop offset="60%" stopColor="#0ea5e9"/><stop offset="100%" stopColor="#0c4a6e" stopOpacity="0"/></radialGradient>
          <radialGradient id="ek_field" cx="50%" cy="45%" r="50%"><stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.15"/><stop offset="100%" stopColor="#0c4a6e" stopOpacity="0"/></radialGradient>
        </defs>
        <circle cx="50" cy="42" r="38" fill="url(#ek_field)"/>
        {/* Containment rings */}
        <circle cx="50" cy="42" r="30" fill="none" stroke="#0369a1" strokeWidth="0.4" opacity="0.2" strokeDasharray="5 3"/>
        <circle cx="50" cy="42" r="26" fill="none" stroke="#0284c7" strokeWidth="0.5" opacity="0.3"/>
        <circle cx="50" cy="42" r="22" fill="none" stroke="#0ea5e9" strokeWidth="0.6" opacity="0.4"/>
        {/* Hexagonal frame */}
        <polygon points="50,14 74,28 74,56 50,70 26,56 26,28" fill="none" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3"/>
        <polygon points="50,18 70,30 70,54 50,66 30,54 30,30" fill="none" stroke="#0ea5e9" strokeWidth="0.5" opacity="0.2"/>
        {/* Core */}
        <circle cx="50" cy="42" r="14" fill="url(#ek_core)"/>
        <circle cx="50" cy="42" r="10" fill="#0ea5e9" opacity="0.8"/>
        <circle cx="50" cy="42" r="6" fill="#38bdf8"/>
        <circle cx="50" cy="42" r="3" fill="#bae6fd"/>
        <circle cx="50" cy="42" r="1.5" fill="white" opacity="0.8"/>
        <circle cx="48" cy="40" r="1.5" fill="white" opacity="0.3"/>
        {/* Energy arcs */}
        <path d="M36 30 Q30 24 26 18" fill="none" stroke="#7dd3fc" strokeWidth="1.2" opacity="0.5" strokeLinecap="round"/>
        <path d="M28 20 L24 14 L22 18" fill="none" stroke="#38bdf8" strokeWidth="0.8" opacity="0.4"/>
        <path d="M64 30 Q70 24 74 18" fill="none" stroke="#7dd3fc" strokeWidth="1.2" opacity="0.5" strokeLinecap="round"/>
        <path d="M72 20 L76 14 L78 18" fill="none" stroke="#38bdf8" strokeWidth="0.8" opacity="0.4"/>
        <path d="M36 55 Q28 62 22 66" fill="none" stroke="#7dd3fc" strokeWidth="0.8" opacity="0.3"/>
        <path d="M64 55 Q72 62 78 66" fill="none" stroke="#7dd3fc" strokeWidth="0.8" opacity="0.3"/>
        {/* Floating energy particles */}
        <circle cx="30" cy="22" r="1.2" fill="#38bdf8" opacity="0.5"/>
        <circle cx="70" cy="22" r="1" fill="#38bdf8" opacity="0.4"/>
        <circle cx="22" cy="50" r="0.8" fill="#7dd3fc" opacity="0.3"/>
        <circle cx="78" cy="50" r="0.8" fill="#7dd3fc" opacity="0.3"/>
        <circle cx="35" cy="68" r="0.6" fill="#0ea5e9" opacity="0.3"/>
        <circle cx="65" cy="68" r="0.6" fill="#0ea5e9" opacity="0.3"/>
        {/* Pulsing rings around core */}
        <circle cx="50" cy="42" r="17" fill="none" stroke="#38bdf8" strokeWidth="0.3" opacity="0.15"/>
        <circle cx="50" cy="42" r="20" fill="none" stroke="#7dd3fc" strokeWidth="0.2" opacity="0.1"/>
      </>
    ),
  },
  athena: {
    bg: 'linear-gradient(180deg, #1e3a5f 0%, #152a45 40%, #0a1628 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="at_wisdom" cx="50%" cy="35%" r="50%"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15"/><stop offset="100%" stopColor="#1e3a5f" stopOpacity="0"/></radialGradient>
        </defs>
        <circle cx="50" cy="35" r="35" fill="url(#at_wisdom)"/>
        {/* Owl behind — wisdom symbol */}
        <path d="M76 20 Q80 12 84 14 Q82 18 80 22" fill="#475569" opacity="0.3"/>
        <path d="M84 20 Q88 12 92 14 Q90 18 88 22" fill="#475569" opacity="0.3"/>
        <circle cx="80" cy="24" r="3" fill="#1e293b" stroke="#475569" strokeWidth="0.4" opacity="0.4"/>
        <circle cx="88" cy="24" r="3" fill="#1e293b" stroke="#475569" strokeWidth="0.4" opacity="0.4"/>
        <circle cx="80" cy="24" r="1.2" fill="#fbbf24" opacity="0.3"/>
        <circle cx="88" cy="24" r="1.2" fill="#fbbf24" opacity="0.3"/>
        {/* Figure — Athena warrior */}
        <path d="M42 32 Q46 22 50 20 Q54 22 58 32 L60 48 L62 62 Q58 68 50 70 Q42 68 38 62 L40 48 Z" fill="#64748b" stroke="#94a3b8" strokeWidth="0.4"/>
        {/* Helmet — Corinthian style */}
        <path d="M40 30 Q40 14 50 10 Q60 14 60 30 L58 34 Q54 36 50 37 Q46 36 42 34 Z" fill="#94a3b8" stroke="#cbd5e1" strokeWidth="0.5"/>
        {/* Helmet crest */}
        <path d="M50 10 Q48 6 50 2 Q52 6 50 10" fill="#dc2626" opacity="0.7"/>
        <path d="M50 10 Q46 8 50 2 Q54 8 50 10 L52 14 Q50 16 48 14 Z" fill="#ef4444" opacity="0.5"/>
        {/* Visor */}
        <path d="M43 26 L57 26 L56 30 L44 30 Z" fill="#1e293b"/>
        {/* Eyes through visor */}
        <circle cx="47" cy="28" r="1.5" fill="#fbbf24"/>
        <circle cx="53" cy="28" r="1.5" fill="#fbbf24"/>
        <circle cx="47" cy="28" r="0.6" fill="#422006"/>
        <circle cx="53" cy="28" r="0.6" fill="#422006"/>
        {/* Nose guard */}
        <line x1="50" y1="24" x2="50" y2="32" stroke="#94a3b8" strokeWidth="1"/>
        {/* Aegis/breastplate */}
        <path d="M42 36 L58 36 L56 50 L44 50 Z" fill="#475569" stroke="#64748b" strokeWidth="0.4"/>
        <circle cx="50" cy="43" r="4" fill="#1e293b" stroke="#93c5fd" strokeWidth="0.5"/>
        <circle cx="50" cy="43" r="2" fill="#3b82f6" opacity="0.5"/>
        {/* Spear — right */}
        <line x1="72" y1="6" x2="72" y2="78" stroke="#94a3b8" strokeWidth="1.5"/>
        <polygon points="72,4 69,12 72,10 75,12" fill="#cbd5e1"/>
        <polygon points="72,4 70,10 72,9 74,10" fill="white" opacity="0.2"/>
        {/* Shield — left hand, round with Medusa */}
        <circle cx="26" cy="45" r="12" fill="#1e40af" stroke="#3b82f6" strokeWidth="1"/>
        <circle cx="26" cy="45" r="9" fill="#1e3a5f" stroke="#93c5fd" strokeWidth="0.5"/>
        <circle cx="26" cy="45" r="5" fill="#1e293b"/>
        {/* Medusa face on shield */}
        <circle cx="26" cy="44" r="2" fill="#94a3b8" opacity="0.5"/>
        <circle cx="25" cy="43" r="0.5" fill="#fbbf24" opacity="0.5"/>
        <circle cx="27" cy="43" r="0.5" fill="#fbbf24" opacity="0.5"/>
        {/* Arms */}
        <path d="M40 38 Q34 40 28 42" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round"/>
        <path d="M60 38 Q66 40 70 42" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round"/>
        {/* Skirt/pteruges */}
        <path d="M42 58 L38 68 M46 60 L44 68 M50 60 L50 70 M54 60 L56 68 M58 58 L62 68" stroke="#475569" strokeWidth="1.5" strokeLinecap="round"/>
        {/* Sandals */}
        <rect x="40" y="68" width="8" height="3" rx="1" fill="#78716c" opacity="0.5"/>
        <rect x="52" y="68" width="8" height="3" rx="1" fill="#78716c" opacity="0.5"/>
        {/* Wisdom glow */}
        <circle cx="50" cy="10" r="3" fill="#fbbf24" opacity="0.06"/>
      </>
    ),
  },
  phoenix: {
    bg: 'linear-gradient(180deg, #7c2d12 0%, #5a1e08 30%, #2a0e04 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="px_flame" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#fbbf24" stopOpacity="0.25"/><stop offset="50%" stopColor="#f97316" stopOpacity="0.1"/><stop offset="100%" stopColor="#7c2d12" stopOpacity="0"/></radialGradient>
        </defs>
        <circle cx="50" cy="42" r="38" fill="url(#px_flame)"/>
        {/* Flame background — layered */}
        <path d="M15 80 Q20 60 25 65 Q28 52 32 62 Q36 48 40 58 Q44 42 48 55 Q50 38 52 55 Q56 42 60 58 Q64 48 68 62 Q72 52 75 65 Q80 60 85 80 Z" fill="#dc2626" opacity="0.2"/>
        <path d="M20 80 Q25 62 30 68 Q34 54 38 64 Q42 48 46 60 Q50 42 54 60 Q58 48 62 64 Q66 54 70 68 Q75 62 80 80 Z" fill="#f97316" opacity="0.15"/>
        {/* Phoenix body */}
        <ellipse cx="50" cy="40" rx="12" ry="10" fill="#ea580c" stroke="#f97316" strokeWidth="0.5"/>
        <ellipse cx="50" cy="42" rx="10" ry="7" fill="#f97316"/>
        {/* Feather texture on body */}
        <path d="M42 38 Q44 36 46 38 Q48 36 50 38 Q52 36 54 38 Q56 36 58 38" fill="none" stroke="#fb923c" strokeWidth="0.4" opacity="0.5"/>
        {/* Head */}
        <circle cx="50" cy="28" r="6" fill="#f97316" stroke="#fb923c" strokeWidth="0.4"/>
        <path d="M48 26 Q50 22 52 26" fill="#fbbf24" opacity="0.5"/>
        {/* Crown feathers */}
        <path d="M48 22 L46 14 L48 18 L50 12 L52 18 L54 14 L52 22" fill="#fbbf24" opacity="0.7"/>
        <circle cx="50" cy="12" r="1" fill="#fef3c7" opacity="0.6"/>
        {/* Eyes — radiant */}
        <circle cx="47" cy="27" r="1.5" fill="#fef3c7"/>
        <circle cx="53" cy="27" r="1.5" fill="#fef3c7"/>
        <circle cx="47" cy="27" r="0.6" fill="#ea580c"/>
        <circle cx="53" cy="27" r="0.6" fill="#ea580c"/>
        {/* Beak */}
        <polygon points="50,30 48,33 52,33" fill="#d97706"/>
        {/* Left wing — spread wide, detailed */}
        <path d="M38 38 Q26 28 10 18" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M38 40 Q28 32 14 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round"/>
        <path d="M38 42 Q30 36 20 32" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
        {/* Feather tips left */}
        <path d="M10 18 Q7 15 4 17 Q7 20 12 20" fill="#fbbf24" opacity="0.6"/>
        <path d="M14 24 Q10 22 8 25 Q12 27 16 26" fill="#f59e0b" opacity="0.5"/>
        <path d="M20 32 Q17 30 15 33 Q18 35 22 34" fill="#ea580c" opacity="0.4"/>
        {/* Right wing */}
        <path d="M62 38 Q74 28 90 18" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M62 40 Q72 32 86 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round"/>
        <path d="M62 42 Q70 36 80 32" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M90 18 Q93 15 96 17 Q93 20 88 20" fill="#fbbf24" opacity="0.6"/>
        <path d="M86 24 Q90 22 92 25 Q88 27 84 26" fill="#f59e0b" opacity="0.5"/>
        {/* Tail flames */}
        <path d="M44 50 Q40 58 38 68 Q36 72 34 78" fill="none" stroke="#fbbf24" strokeWidth="1.5" opacity="0.6"/>
        <path d="M46 50 Q44 60 42 70 Q40 75 38 80" fill="none" stroke="#f97316" strokeWidth="1.2" opacity="0.5"/>
        <path d="M50 50 Q50 62 50 72 Q50 76 50 82" fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.4"/>
        <path d="M54 50 Q56 60 58 70 Q60 75 62 80" fill="none" stroke="#f97316" strokeWidth="1.2" opacity="0.5"/>
        <path d="M56 50 Q60 58 62 68 Q64 72 66 78" fill="none" stroke="#fbbf24" strokeWidth="1.5" opacity="0.6"/>
        {/* Embers */}
        <circle cx="25" cy="55" r="0.8" fill="#fbbf24" opacity="0.4"/>
        <circle cx="75" cy="52" r="0.6" fill="#fbbf24" opacity="0.3"/>
        <circle cx="18" cy="40" r="0.5" fill="#fef3c7" opacity="0.3"/>
        <circle cx="82" cy="38" r="0.5" fill="#fef3c7" opacity="0.3"/>
      </>
    ),
  },
  erzmagier: {
    bg: 'linear-gradient(180deg, #1e1b4b 0%, #15124a 40%, #0a0830 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="em_power" cx="50%" cy="25%" r="40%"><stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.2"/><stop offset="100%" stopColor="#1e1b4b" stopOpacity="0"/></radialGradient>
        </defs>
        <circle cx="50" cy="30" r="35" fill="url(#em_power)"/>
        {/* Arcane circles background */}
        <circle cx="50" cy="42" r="32" fill="none" stroke="#4338ca" strokeWidth="0.3" opacity="0.15" strokeDasharray="4 3 1 3"/>
        <circle cx="50" cy="42" r="28" fill="none" stroke="#6366f1" strokeWidth="0.2" opacity="0.1" strokeDasharray="2 4"/>
        {/* Figure — robed archmage */}
        <path d="M40 30 Q44 18 50 14 Q56 18 60 30 L64 60 Q60 72 50 75 Q40 72 36 60 Z" fill="#312e81" stroke="#4338ca" strokeWidth="0.4"/>
        {/* Massive robe flowing */}
        <path d="M36 60 Q30 65 26 72 Q24 78 28 80" fill="none" stroke="#312e81" strokeWidth="2" opacity="0.5"/>
        <path d="M64 60 Q70 65 74 72 Q76 78 72 80" fill="none" stroke="#312e81" strokeWidth="2" opacity="0.5"/>
        {/* Hood */}
        <path d="M42 32 Q44 20 50 16 Q56 20 58 32 Q55 35 50 36 Q45 35 42 32 Z" fill="#1e1b4b" stroke="#4338ca" strokeWidth="0.3"/>
        {/* Glowing eyes */}
        <circle cx="47" cy="28" r="1.5" fill="#a5b4fc" opacity="0.8"/>
        <circle cx="53" cy="28" r="1.5" fill="#a5b4fc" opacity="0.8"/>
        <circle cx="47" cy="28" r="0.5" fill="white" opacity="0.6"/>
        <circle cx="53" cy="28" r="0.5" fill="white" opacity="0.6"/>
        {/* Staff — ornate */}
        <line x1="74" y1="8" x2="74" y2="76" stroke="#6366f1" strokeWidth="2"/>
        <line x1="74" y1="8" x2="74" y2="76" stroke="#818cf8" strokeWidth="1"/>
        {/* Staff head — crystal */}
        <polygon points="74,4 78,10 74,16 70,10" fill="#818cf8" stroke="#a5b4fc" strokeWidth="0.5"/>
        <polygon points="74,6 76,10 74,14 72,10" fill="#a5b4fc" opacity="0.5"/>
        <circle cx="74" cy="10" r="1.5" fill="#e0e7ff" opacity="0.8"/>
        {/* Staff rings */}
        <ellipse cx="74" cy="22" rx="3" ry="1" fill="none" stroke="#818cf8" strokeWidth="0.5" opacity="0.5"/>
        <ellipse cx="74" cy="40" rx="3" ry="1" fill="none" stroke="#6366f1" strokeWidth="0.5" opacity="0.4"/>
        {/* Arm holding staff */}
        <path d="M58 38 Q66 36 72 32" fill="none" stroke="#312e81" strokeWidth="2" strokeLinecap="round"/>
        {/* Casting hand — left */}
        <path d="M40 38 Q32 34 26 30" fill="none" stroke="#312e81" strokeWidth="2" strokeLinecap="round"/>
        {/* Magic being cast from left hand */}
        <circle cx="24" cy="28" r="4" fill="#6366f1" opacity="0.3"/>
        <circle cx="24" cy="28" r="2.5" fill="#818cf8" opacity="0.4"/>
        <circle cx="24" cy="28" r="1" fill="#c7d2fe" opacity="0.6"/>
        {/* Arcane symbols floating */}
        <circle cx="15" cy="20" r="3" fill="none" stroke="#a5b4fc" strokeWidth="0.4" opacity="0.3"/>
        <line x1="13" y1="20" x2="17" y2="20" stroke="#a5b4fc" strokeWidth="0.3" opacity="0.3"/>
        <line x1="15" y1="18" x2="15" y2="22" stroke="#a5b4fc" strokeWidth="0.3" opacity="0.3"/>
        <polygon points="84,22 87,26 84,30 81,26" fill="none" stroke="#818cf8" strokeWidth="0.4" opacity="0.3"/>
        <circle cx="20" cy="55" r="2.5" fill="none" stroke="#6366f1" strokeWidth="0.3" opacity="0.2"/>
        {/* Floating rune particles */}
        <circle cx="32" cy="18" r="0.6" fill="#a5b4fc" opacity="0.4"/>
        <circle cx="68" cy="15" r="0.5" fill="#a5b4fc" opacity="0.3"/>
        <circle cx="12" cy="42" r="0.5" fill="#818cf8" opacity="0.3"/>
        <circle cx="88" cy="45" r="0.4" fill="#818cf8" opacity="0.2"/>
      </>
    ),
  },
  kriegsherr: {
    bg: 'linear-gradient(180deg, #7f1d1d 0%, #5a1414 40%, #2a0a0a 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="kh_fire" cx="50%" cy="60%" r="50%"><stop offset="0%" stopColor="#dc2626" stopOpacity="0.1"/><stop offset="100%" stopColor="#7f1d1d" stopOpacity="0"/></radialGradient>
        </defs>
        <circle cx="50" cy="55" r="35" fill="url(#kh_fire)"/>
        {/* Battle banner — background */}
        <line x1="78" y1="6" x2="78" y2="78" stroke="#a16207" strokeWidth="2"/>
        <circle cx="78" cy="5" r="2" fill="#d97706"/>
        <path d="M80 10 L95 10 Q93 20 95 30 L80 30 Z" fill="#dc2626" stroke="#b91c1c" strokeWidth="0.4"/>
        <path d="M80 30 L83 34 L86 30 L89 34 L92 30 L95 34" fill="none" stroke="#dc2626" strokeWidth="1"/>
        {/* Star on banner */}
        <polygon points="88,16 89.5,20 93,20 90,22.5 91,26 88,24 85,26 86,22.5 83,20 86.5,20" fill="#fbbf24" opacity="0.7"/>
        {/* Armored warlord figure */}
        <path d="M40 28 Q44 18 50 16 Q56 18 60 28 L62 50 Q60 62 50 66 Q40 62 38 50 Z" fill="#991b1b" stroke="#b91c1c" strokeWidth="0.5"/>
        {/* Spiky helmet */}
        <path d="M42 28 Q44 16 50 12 Q56 16 58 28 L56 32 Q53 34 50 35 Q47 34 44 32 Z" fill="#71717a" stroke="#a1a1aa" strokeWidth="0.5"/>
        <path d="M50 12 L50 4" stroke="#a1a1aa" strokeWidth="1.5"/>
        <circle cx="50" cy="3" r="1.5" fill="#dc2626"/>
        {/* Helmet horns */}
        <path d="M42 22 L36 12 L40 18" fill="#71717a" stroke="#a1a1aa" strokeWidth="0.3"/>
        <path d="M58 22 L64 12 L60 18" fill="#71717a" stroke="#a1a1aa" strokeWidth="0.3"/>
        {/* Visor */}
        <rect x="44" y="24" width="12" height="3" rx="0.5" fill="#3f3f46"/>
        <line x1="45" y1="25.5" x2="55" y2="25.5" stroke="#dc2626" strokeWidth="0.6" opacity="0.6"/>
        {/* Armor detail */}
        <path d="M42 36 L58 36 L56 48 L44 48 Z" fill="#7f1d1d" stroke="#991b1b" strokeWidth="0.4"/>
        {/* Skull emblem on chest */}
        <circle cx="50" cy="41" r="3.5" fill="#3f3f46"/>
        <circle cx="48.5" cy="40" r="1" fill="#dc2626" opacity="0.5"/>
        <circle cx="51.5" cy="40" r="1" fill="#dc2626" opacity="0.5"/>
        {/* Pauldrons — spiky */}
        <path d="M38 30 Q30 26 24 28 Q22 32 26 36 L38 34 Z" fill="#71717a" stroke="#a1a1aa" strokeWidth="0.3"/>
        <path d="M24 28 L20 24" stroke="#a1a1aa" strokeWidth="0.8"/>
        <path d="M62 30 Q70 26 76 28 Q78 32 74 36 L62 34 Z" fill="#71717a" stroke="#a1a1aa" strokeWidth="0.3"/>
        <path d="M76 28 L80 24" stroke="#a1a1aa" strokeWidth="0.8"/>
        {/* Battle axe — left hand */}
        <line x1="22" y1="14" x2="22" y2="72" stroke="#78716c" strokeWidth="1.5"/>
        <path d="M14 18 Q10 24 14 30 L22 24 Z" fill="#a1a1aa" stroke="#d4d4d8" strokeWidth="0.4"/>
        <path d="M16 20 Q14 24 16 28 L22 24 Z" fill="#d4d4d8" opacity="0.3"/>
        {/* Arm to axe */}
        <path d="M38 36 Q30 38 24 36" fill="none" stroke="#991b1b" strokeWidth="2" strokeLinecap="round"/>
        {/* Legs */}
        <rect x="42" y="62" width="7" height="12" rx="1.5" fill="#71717a" stroke="#a1a1aa" strokeWidth="0.3"/>
        <rect x="51" y="62" width="7" height="12" rx="1.5" fill="#71717a" stroke="#a1a1aa" strokeWidth="0.3"/>
        {/* Blood splatter */}
        <circle cx="14" cy="24" r="0.8" fill="#dc2626" opacity="0.4"/>
        <circle cx="12" cy="28" r="0.5" fill="#dc2626" opacity="0.3"/>
        {/* Ground shadow */}
        <ellipse cx="50" cy="78" rx="22" ry="3" fill="#000" opacity="0.15"/>
      </>
    ),
  },
  seelendieb: {
    bg: 'linear-gradient(180deg, #3b0764 0%, #2a054a 40%, #140228 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="sd_souls" cx="50%" cy="40%" r="50%"><stop offset="0%" stopColor="#7c3aed" stopOpacity="0.15"/><stop offset="100%" stopColor="#3b0764" stopOpacity="0"/></radialGradient>
        </defs>
        <circle cx="50" cy="42" r="35" fill="url(#sd_souls)"/>
        {/* Hooded thief figure */}
        <path d="M42 28 Q46 16 50 14 Q54 16 58 28 L62 55 Q60 68 50 72 Q40 68 38 55 Z" fill="#581c87" stroke="#7c3aed" strokeWidth="0.3"/>
        {/* Deep hood */}
        <path d="M43 30 Q46 18 50 15 Q54 18 57 30 Q54 33 50 34 Q46 33 43 30 Z" fill="#3b0764" stroke="#6d28d9" strokeWidth="0.3"/>
        {/* No visible face — just void */}
        <ellipse cx="50" cy="26" rx="4" ry="3.5" fill="#140228"/>
        {/* Faint eyes */}
        <circle cx="48" cy="25.5" r="0.8" fill="#2dd4bf" opacity="0.6"/>
        <circle cx="52" cy="25.5" r="0.8" fill="#2dd4bf" opacity="0.6"/>
        {/* Hands outstretched — stealing souls */}
        <path d="M38 40 Q30 36 22 34" fill="none" stroke="#581c87" strokeWidth="2" strokeLinecap="round"/>
        <path d="M62 40 Q70 36 78 34" fill="none" stroke="#581c87" strokeWidth="2" strokeLinecap="round"/>
        {/* Soul wisps being pulled — left */}
        <path d="M8 18 Q12 22 16 28 Q20 34 22 34" fill="none" stroke="#a78bfa" strokeWidth="1.5" opacity="0.5" strokeLinecap="round"/>
        <path d="M12 12 Q16 18 20 26 Q22 32 22 34" fill="none" stroke="#c4b5fd" strokeWidth="1" opacity="0.4" strokeLinecap="round"/>
        <circle cx="8" cy="16" r="3" fill="#5eead4" opacity="0.3"/>
        <circle cx="8" cy="16" r="1.5" fill="#2dd4bf" opacity="0.4"/>
        <circle cx="12" cy="10" r="2.5" fill="#99f6e4" opacity="0.2"/>
        {/* Soul wisps — right */}
        <path d="M92 18 Q88 22 84 28 Q80 34 78 34" fill="none" stroke="#a78bfa" strokeWidth="1.5" opacity="0.5" strokeLinecap="round"/>
        <path d="M88 12 Q84 18 80 26 Q78 32 78 34" fill="none" stroke="#c4b5fd" strokeWidth="1" opacity="0.4" strokeLinecap="round"/>
        <circle cx="92" cy="16" r="3" fill="#5eead4" opacity="0.3"/>
        <circle cx="92" cy="16" r="1.5" fill="#2dd4bf" opacity="0.4"/>
        <circle cx="88" cy="10" r="2.5" fill="#99f6e4" opacity="0.2"/>
        {/* Central soul being absorbed */}
        <path d="M50 48 Q50 38 50 32" fill="none" stroke="#c4b5fd" strokeWidth="2" opacity="0.6" strokeLinecap="round"/>
        <circle cx="50" cy="50" r="4" fill="#7c3aed" opacity="0.3"/>
        <circle cx="50" cy="50" r="2.5" fill="#a78bfa" opacity="0.3"/>
        {/* Stolen soul orbs floating around */}
        <circle cx="36" cy="52" r="2" fill="#5eead4" opacity="0.2"/>
        <circle cx="64" cy="50" r="1.5" fill="#5eead4" opacity="0.15"/>
        <circle cx="44" cy="60" r="1.5" fill="#2dd4bf" opacity="0.15"/>
        <circle cx="58" cy="62" r="1.5" fill="#2dd4bf" opacity="0.1"/>
        {/* Ground mist */}
        <ellipse cx="50" cy="72" rx="25" ry="5" fill="#7c3aed" opacity="0.06"/>
        {/* Robe hem detail */}
        <path d="M38 65 Q34 68 30 72 Q28 74 30 76" fill="none" stroke="#581c87" strokeWidth="1.5" opacity="0.4"/>
        <path d="M62 65 Q66 68 70 72 Q72 74 70 76" fill="none" stroke="#581c87" strokeWidth="1.5" opacity="0.4"/>
      </>
    ),
  },
  // ── Epics ──
  treant: {
    bg: 'linear-gradient(180deg, #052e16 0%, #041f10 40%, #021008 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="tr_life" cx="50%" cy="30%" r="50%"><stop offset="0%" stopColor="#22c55e" stopOpacity="0.12"/><stop offset="100%" stopColor="#052e16" stopOpacity="0"/></radialGradient>
        </defs>
        <circle cx="50" cy="35" r="38" fill="url(#tr_life)"/>
        {/* Massive trunk */}
        <path d="M38 78 L40 55 Q38 45 36 38 L36 32 Q40 28 42 24 L44 18 Q48 12 50 8 Q52 12 56 18 L58 24 Q60 28 64 32 L64 38 Q62 45 60 55 L62 78 Z" fill="#57534e" stroke="#78716c" strokeWidth="0.5"/>
        {/* Bark texture */}
        <path d="M42 30 Q44 28 46 30" fill="none" stroke="#44403c" strokeWidth="0.5" opacity="0.6"/>
        <path d="M54 30 Q56 28 58 30" fill="none" stroke="#44403c" strokeWidth="0.5" opacity="0.6"/>
        <path d="M40 42 Q42 40 44 42" fill="none" stroke="#44403c" strokeWidth="0.4" opacity="0.5"/>
        <path d="M56 42 Q58 40 60 42" fill="none" stroke="#44403c" strokeWidth="0.4" opacity="0.5"/>
        <path d="M42 55 L44 52 L42 50" fill="none" stroke="#44403c" strokeWidth="0.4" opacity="0.4"/>
        <path d="M58 55 L56 52 L58 50" fill="none" stroke="#44403c" strokeWidth="0.4" opacity="0.4"/>
        {/* Face in the trunk */}
        <ellipse cx="45" cy="42" rx="3.5" ry="2.5" fill="#14532d" stroke="#166534" strokeWidth="0.3"/>
        <ellipse cx="55" cy="42" rx="3.5" ry="2.5" fill="#14532d" stroke="#166534" strokeWidth="0.3"/>
        <circle cx="45" cy="42" r="1.5" fill="#22c55e" opacity="0.8"/>
        <circle cx="55" cy="42" r="1.5" fill="#22c55e" opacity="0.8"/>
        <circle cx="45" cy="42" r="0.5" fill="#86efac"/>
        <circle cx="55" cy="42" r="0.5" fill="#86efac"/>
        {/* Mouth — weathered groove */}
        <path d="M46 50 Q48 52 50 51 Q52 52 54 50" fill="none" stroke="#14532d" strokeWidth="1.5"/>
        {/* Crown — massive canopy */}
        <circle cx="50" cy="10" r="14" fill="#16a34a" opacity="0.7"/>
        <circle cx="38" cy="16" r="11" fill="#15803d" opacity="0.65"/>
        <circle cx="62" cy="16" r="11" fill="#15803d" opacity="0.65"/>
        <circle cx="30" cy="24" r="9" fill="#166534" opacity="0.55"/>
        <circle cx="70" cy="24" r="9" fill="#166534" opacity="0.55"/>
        <circle cx="22" cy="32" r="7" fill="#14532d" opacity="0.45"/>
        <circle cx="78" cy="32" r="7" fill="#14532d" opacity="0.45"/>
        {/* Leaf detail highlights */}
        <circle cx="44" cy="6" r="2" fill="#4ade80" opacity="0.2"/>
        <circle cx="56" cy="8" r="2" fill="#4ade80" opacity="0.15"/>
        <circle cx="34" cy="12" r="1.5" fill="#4ade80" opacity="0.15"/>
        {/* Branch arms */}
        <path d="M36 36 Q28 32 18 30 Q14 28 10 26" fill="none" stroke="#57534e" strokeWidth="3" strokeLinecap="round"/>
        <path d="M18 30 Q14 26 10 22" fill="none" stroke="#57534e" strokeWidth="2" strokeLinecap="round"/>
        <path d="M64 36 Q72 32 82 30 Q86 28 90 26" fill="none" stroke="#57534e" strokeWidth="3" strokeLinecap="round"/>
        <path d="M82 30 Q86 26 90 22" fill="none" stroke="#57534e" strokeWidth="2" strokeLinecap="round"/>
        {/* Leaves on branch tips */}
        <ellipse cx="10" cy="24" rx="3" ry="1.5" fill="#22c55e" opacity="0.5" transform="rotate(-30 10 24)"/>
        <ellipse cx="90" cy="24" rx="3" ry="1.5" fill="#22c55e" opacity="0.5" transform="rotate(30 90 24)"/>
        {/* Roots */}
        <path d="M38 78 Q30 80 22 78 Q18 76 14 78" fill="none" stroke="#57534e" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M62 78 Q70 80 78 78 Q82 76 86 78" fill="none" stroke="#57534e" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M46 78 Q44 82 40 84" fill="none" stroke="#44403c" strokeWidth="1.5" opacity="0.5"/>
        <path d="M54 78 Q56 82 60 84" fill="none" stroke="#44403c" strokeWidth="1.5" opacity="0.5"/>
        {/* Fireflies */}
        <circle cx="16" cy="50" r="0.7" fill="#86efac" opacity="0.5"/>
        <circle cx="84" cy="48" r="0.6" fill="#86efac" opacity="0.4"/>
        <circle cx="28" cy="62" r="0.5" fill="#4ade80" opacity="0.3"/>
        <circle cx="72" cy="60" r="0.5" fill="#4ade80" opacity="0.3"/>
      </>
    ),
  },
  lichkoenig: {
    bg: 'linear-gradient(180deg, #0c4a6e 0%, #083344 40%, #04202e 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="lk_frost" cx="50%" cy="35%" r="50%"><stop offset="0%" stopColor="#22d3ee" stopOpacity="0.15"/><stop offset="100%" stopColor="#0c4a6e" stopOpacity="0"/></radialGradient>
        </defs>
        <circle cx="50" cy="38" r="36" fill="url(#lk_frost)"/>
        {/* Armored figure */}
        <path d="M38 34 Q42 22 50 18 Q58 22 62 34 L64 55 Q62 66 50 70 Q38 66 36 55 Z" fill="#164e63" stroke="#22d3ee" strokeWidth="0.3"/>
        {/* Skull face */}
        <path d="M40 30 Q40 18 50 14 Q60 18 60 30 L60 42 Q58 48 50 50 Q42 48 40 42 Z" fill="#e7e5e4" stroke="#d6d3d1" strokeWidth="0.4"/>
        <path d="M42 28 Q42 20 50 16 Q58 20 58 28 L58 40 Q56 45 50 47 Q44 45 42 40 Z" fill="#f5f5f4"/>
        {/* Eye sockets — deep, glowing */}
        <ellipse cx="45" cy="32" rx="4" ry="4.5" fill="#083344"/>
        <ellipse cx="55" cy="32" rx="4" ry="4.5" fill="#083344"/>
        <circle cx="45" cy="32" r="2.5" fill="#22d3ee" opacity="0.8"/>
        <circle cx="55" cy="32" r="2.5" fill="#22d3ee" opacity="0.8"/>
        <circle cx="45" cy="32" r="1" fill="#a5f3fc"/>
        <circle cx="55" cy="32" r="1" fill="#a5f3fc"/>
        <circle cx="44.5" cy="31.5" r="0.4" fill="white" opacity="0.7"/>
        <circle cx="54.5" cy="31.5" r="0.4" fill="white" opacity="0.7"/>
        {/* Nose */}
        <path d="M48 38 L50 35 L52 38 Z" fill="#d6d3d1"/>
        {/* Teeth */}
        <path d="M44 42 L46 40 L48 42 L50 40 L52 42 L54 40 L56 42" fill="none" stroke="#d6d3d1" strokeWidth="0.8"/>
        {/* Crack in skull */}
        <path d="M48 18 L46 22 L48 26 L46 30" fill="none" stroke="#a8a29e" strokeWidth="0.4" opacity="0.5"/>
        {/* Ice Crown — ornate jagged */}
        <path d="M30 28 L34 10 L38 22 L43 6 L48 18 L50 4 L52 18 L57 6 L62 22 L66 10 L70 28 Z" fill="#22d3ee" opacity="0.6" stroke="#67e8f9" strokeWidth="0.5"/>
        <path d="M32 26 L35 12 L39 22 L44 8 L48 18 L50 6 L52 18 L56 8 L61 22 L65 12 L68 26 Z" fill="#a5f3fc" opacity="0.2"/>
        {/* Crown jewels */}
        <circle cx="43" cy="14" r="2" fill="#a5f3fc" opacity="0.6"/>
        <circle cx="50" cy="10" r="2.5" fill="#cffafe" opacity="0.7"/>
        <circle cx="57" cy="14" r="2" fill="#a5f3fc" opacity="0.6"/>
        <circle cx="34" cy="18" r="1.5" fill="#67e8f9" opacity="0.4"/>
        <circle cx="66" cy="18" r="1.5" fill="#67e8f9" opacity="0.4"/>
        {/* Frost armor detail */}
        <path d="M38 40 L36 48 L38 55" fill="none" stroke="#22d3ee" strokeWidth="0.3" opacity="0.3"/>
        <path d="M62 40 L64 48 L62 55" fill="none" stroke="#22d3ee" strokeWidth="0.3" opacity="0.3"/>
        {/* Pauldrons with ice spikes */}
        <path d="M36 36 Q28 32 24 34 Q22 38 26 42 L36 40 Z" fill="#164e63" stroke="#22d3ee" strokeWidth="0.3"/>
        <path d="M24 34 L20 28" stroke="#67e8f9" strokeWidth="0.8" opacity="0.5"/>
        <path d="M64 36 Q72 32 76 34 Q78 38 74 42 L64 40 Z" fill="#164e63" stroke="#22d3ee" strokeWidth="0.3"/>
        <path d="M76 34 L80 28" stroke="#67e8f9" strokeWidth="0.8" opacity="0.5"/>
        {/* Frost mist */}
        <ellipse cx="50" cy="72" rx="30" ry="6" fill="#22d3ee" opacity="0.04"/>
        {/* Ice particles */}
        <polygon points="18,45 19,43 20,45 19,47" fill="#a5f3fc" opacity="0.3"/>
        <polygon points="82,42 83,40 84,42 83,44" fill="#a5f3fc" opacity="0.25"/>
        <circle cx="14" cy="55" r="0.5" fill="#67e8f9" opacity="0.3"/>
        <circle cx="86" cy="52" r="0.5" fill="#67e8f9" opacity="0.3"/>
      </>
    ),
  },
  zeus: {
    bg: 'linear-gradient(180deg, #1e3a5f 0%, #162a42 30%, #0a1628 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="zs_storm" cx="50%" cy="25%" r="60%"><stop offset="0%" stopColor="#64748b" stopOpacity="0.3"/><stop offset="100%" stopColor="#1e3a5f" stopOpacity="0"/></radialGradient>
        </defs>
        {/* Storm clouds */}
        <circle cx="50" cy="20" r="38" fill="url(#zs_storm)"/>
        <ellipse cx="25" cy="16" rx="20" ry="10" fill="#475569" opacity="0.6"/>
        <ellipse cx="50" cy="14" rx="24" ry="12" fill="#64748b" opacity="0.5"/>
        <ellipse cx="75" cy="18" rx="18" ry="9" fill="#475569" opacity="0.5"/>
        <ellipse cx="38" cy="10" rx="14" ry="8" fill="#94a3b8" opacity="0.3"/>
        <ellipse cx="65" cy="12" rx="12" ry="7" fill="#94a3b8" opacity="0.25"/>
        {/* Figure — Zeus enthroned */}
        <path d="M40 40 Q44 32 50 30 Q56 32 60 40 L62 58 Q60 68 50 72 Q40 68 38 58 Z" fill="#475569" stroke="#64748b" strokeWidth="0.4"/>
        {/* Head */}
        <circle cx="50" cy="34" r="6" fill="#94a3b8"/>
        {/* Beard */}
        <path d="M44 36 Q46 42 50 44 Q54 42 56 36" fill="#cbd5e1" opacity="0.5"/>
        <path d="M45 38 Q48 44 50 45 Q52 44 55 38" fill="#e2e8f0" opacity="0.3"/>
        {/* Eyes — lightning */}
        <circle cx="48" cy="33" r="1.2" fill="#facc15"/>
        <circle cx="52" cy="33" r="1.2" fill="#facc15"/>
        <circle cx="48" cy="33" r="0.5" fill="white"/>
        <circle cx="52" cy="33" r="0.5" fill="white"/>
        {/* Crown of laurels */}
        <path d="M44 30 Q42 26 44 24 Q46 26 44 30" fill="#facc15" opacity="0.4"/>
        <path d="M48 28 Q46 24 48 22 Q50 24 48 28" fill="#facc15" opacity="0.4"/>
        <path d="M52 28 Q54 24 52 22 Q50 24 52 28" fill="#facc15" opacity="0.4"/>
        <path d="M56 30 Q58 26 56 24 Q54 26 56 30" fill="#facc15" opacity="0.4"/>
        {/* Right arm raised — throwing bolt */}
        <path d="M60 42 Q68 34 74 26" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinecap="round"/>
        {/* Main lightning bolt — being thrown */}
        <polygon points="76,22 80,22 68,46 74,46 56,78 66,50 60,50" fill="#facc15"/>
        <polygon points="77,24 79,24 68,44 73,44 58,74 66,48 62,48" fill="#fef08a" opacity="0.7"/>
        {/* Lightning core glow */}
        <polygon points="78,23 68,45 73,45 58,76 66,49 62,49" fill="white" opacity="0.1"/>
        {/* Secondary bolt */}
        <polygon points="28,24 30,24 24,40 27,40 20,52 24,42 22,42" fill="#eab308" opacity="0.4"/>
        {/* Electric sparks at bolt */}
        <circle cx="58" cy="74" r="2" fill="#fef08a" opacity="0.4"/>
        <circle cx="56" cy="78" r="3" fill="#facc15" opacity="0.2"/>
        <path d="M56 78 L52 80 M56 78 L58 82 M56 78 L60 78" stroke="#fef08a" strokeWidth="0.5" opacity="0.4"/>
        {/* Robe flowing */}
        <path d="M38 58 Q32 64 28 72" fill="none" stroke="#475569" strokeWidth="2" opacity="0.4"/>
        <path d="M42 62 Q38 68 34 76" fill="none" stroke="#64748b" strokeWidth="1.5" opacity="0.3"/>
        {/* Rain streaks */}
        <line x1="10" y1="22" x2="8" y2="30" stroke="#94a3b8" strokeWidth="0.3" opacity="0.2"/>
        <line x1="15" y1="18" x2="13" y2="26" stroke="#94a3b8" strokeWidth="0.3" opacity="0.15"/>
        <line x1="90" y1="20" x2="88" y2="28" stroke="#94a3b8" strokeWidth="0.3" opacity="0.15"/>
        <line x1="85" y1="24" x2="83" y2="32" stroke="#94a3b8" strokeWidth="0.3" opacity="0.2"/>
      </>
    ),
  },
  fenrir: {
    bg: 'linear-gradient(180deg, #18181b 0%, #0f0f12 40%, #060608 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="fn_moon" cx="22%" cy="18%" r="15%"><stop offset="0%" stopColor="#e2e8f0"/><stop offset="40%" stopColor="#94a3b8" stopOpacity="0.5"/><stop offset="100%" stopColor="#18181b" stopOpacity="0"/></radialGradient>
          <radialGradient id="fn_shadow" cx="55%" cy="65%" r="40%"><stop offset="0%" stopColor="#000" stopOpacity="0.2"/><stop offset="100%" stopColor="#18181b" stopOpacity="0"/></radialGradient>
        </defs>
        {/* Moon */}
        <circle cx="22" cy="15" r="10" fill="url(#fn_moon)"/>
        <circle cx="22" cy="15" r="7" fill="#cbd5e1" opacity="0.12"/>
        <circle cx="25" cy="13" r="6" fill="#18181b" opacity="0.5"/>
        {/* Ground shadow */}
        <ellipse cx="55" cy="72" rx="35" ry="6" fill="url(#fn_shadow)"/>
        {/* Body — massive crouching wolf */}
        <path d="M18 62 Q16 52 20 46 Q24 40 32 38 Q38 36 44 38 Q48 36 52 35 Q56 34 62 36 Q68 38 74 42 Q80 48 82 56 Q84 62 80 68 L20 68 Q16 64 18 62 Z" fill="#3f3f46" stroke="#52525b" strokeWidth="0.4"/>
        {/* Darker underbelly */}
        <path d="M25 60 Q35 58 50 56 Q65 58 75 60 Q80 64 78 68 L22 68 Q20 64 25 60 Z" fill="#27272a"/>
        {/* Fur texture */}
        <path d="M30 46 Q32 44 34 46 Q36 44 38 46" fill="none" stroke="#52525b" strokeWidth="0.4" opacity="0.5"/>
        <path d="M55 42 Q57 40 59 42 Q61 40 63 42" fill="none" stroke="#52525b" strokeWidth="0.4" opacity="0.5"/>
        <path d="M42 50 Q44 48 46 50 Q48 48 50 50" fill="none" stroke="#52525b" strokeWidth="0.4" opacity="0.4"/>
        {/* Head — snarling */}
        <path d="M74 44 Q80 36 84 30 Q86 26 84 22 L80 28 Q78 24 76 18 L74 26 Q70 32 68 40 Q72 44 74 48 Z" fill="#3f3f46" stroke="#52525b" strokeWidth="0.4"/>
        <path d="M76 38 Q82 30 84 24" fill="none" stroke="#52525b" strokeWidth="0.3"/>
        {/* Ears — pointed */}
        <polygon points="76,18 78,8 82,20" fill="#52525b" stroke="#71717a" strokeWidth="0.3"/>
        <polygon points="84,22 86,12 88,24" fill="#52525b" stroke="#71717a" strokeWidth="0.3"/>
        <polygon points="77,18 79,10 81,19" fill="#3f3f46"/>
        <polygon points="85,22 87,14 87,23" fill="#3f3f46"/>
        {/* Eye — fierce red */}
        <ellipse cx="78" cy="30" rx="3" ry="2" fill="#27272a"/>
        <circle cx="78" cy="30" r="2" fill="#ef4444"/>
        <circle cx="78" cy="30" r="1" fill="#fca5a5"/>
        <circle cx="77.5" cy="29.5" r="0.4" fill="white" opacity="0.6"/>
        {/* Snout and teeth */}
        <path d="M84 28 Q88 30 92 30 Q90 32 86 32 Z" fill="#52525b"/>
        <path d="M86 30 L90 34 L88 32" fill="none" stroke="#71717a" strokeWidth="0.5"/>
        {/* Fangs */}
        <path d="M86 32 L84 36 M88 32 L87 35 M90 32 L90 35" stroke="#e5e5e5" strokeWidth="0.6"/>
        <path d="M92 30 L94 32 M92 30 L95 30" stroke="#3f3f46" strokeWidth="0.5"/>
        {/* Drool/breath in cold */}
        <path d="M92 32 Q94 34 93 36" fill="none" stroke="#71717a" strokeWidth="0.3" opacity="0.3"/>
        {/* Tail — curling */}
        <path d="M18 58 Q12 52 8 44 Q6 38 10 32 Q12 28 14 30" fill="none" stroke="#3f3f46" strokeWidth="3.5" strokeLinecap="round"/>
        <path d="M18 58 Q12 52 8 44 Q6 38 10 32" fill="none" stroke="#52525b" strokeWidth="2" strokeLinecap="round"/>
        {/* Paws */}
        <path d="M30 68 L28 74 L34 74 L32 68" fill="#3f3f46"/>
        <path d="M60 68 L58 74 L64 74 L62 68" fill="#3f3f46"/>
        <path d="M28 74 L26 76 M30 74 L30 76 M32 74 L34 76" stroke="#71717a" strokeWidth="0.5"/>
        {/* Chains (Norse myth) */}
        <path d="M50 48 Q42 46 36 50 Q30 52 26 48" fill="none" stroke="#a1a1aa" strokeWidth="0.8" opacity="0.3" strokeDasharray="2 1.5"/>
        {/* Howl lines / breath mist */}
        <path d="M92 28 Q96 26 98 28" fill="none" stroke="#71717a" strokeWidth="0.5" opacity="0.3"/>
        <path d="M94 26 Q98 24 100 26" fill="none" stroke="#71717a" strokeWidth="0.4" opacity="0.2"/>
        {/* Snow particles */}
        <circle cx="10" cy="22" r="0.5" fill="#e2e8f0" opacity="0.2"/>
        <circle cx="40" cy="10" r="0.4" fill="#e2e8f0" opacity="0.15"/>
        <circle cx="65" cy="12" r="0.4" fill="#e2e8f0" opacity="0.15"/>
        <circle cx="90" cy="18" r="0.3" fill="#e2e8f0" opacity="0.1"/>
      </>
    ),
  },
  // ── Legendary ──
  titan_mk3: {
    bg: 'linear-gradient(180deg, #422006 0%, #2a1504 30%, #1a0a02 100%)',
    svg: (
      <>
        <defs>
          <radialGradient id="tm_core" cx="50%" cy="42%" r="20%"><stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5"/><stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.2"/><stop offset="100%" stopColor="#422006" stopOpacity="0"/></radialGradient>
          <linearGradient id="tm_metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a1a1aa"/><stop offset="50%" stopColor="#71717a"/><stop offset="100%" stopColor="#52525b"/></linearGradient>
          <radialGradient id="tm_aura" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#f59e0b" stopOpacity="0.1"/><stop offset="100%" stopColor="#422006" stopOpacity="0"/></radialGradient>
        </defs>
        <circle cx="50" cy="45" r="40" fill="url(#tm_aura)"/>
        {/* Ground impact cracks */}
        <path d="M50 76 L42 80 M50 76 L58 80 M50 76 L46 82 M50 76 L54 82 M50 76 L38 78 M50 76 L62 78" stroke="#d97706" strokeWidth="0.4" opacity="0.15"/>
        <ellipse cx="50" cy="76" rx="20" ry="3" fill="#d97706" opacity="0.06"/>
        {/* Legs — heavy armored */}
        <path d="M38 60 L36 72 L32 76 L44 76 L42 62 Z" fill="url(#tm_metal)" stroke="#a1a1aa" strokeWidth="0.4"/>
        <path d="M58 60 L60 72 L64 76 L52 76 L54 62 Z" fill="url(#tm_metal)" stroke="#a1a1aa" strokeWidth="0.4"/>
        {/* Knee joints */}
        <circle cx="40" cy="62" r="2.5" fill="#52525b" stroke="#71717a" strokeWidth="0.4"/>
        <circle cx="60" cy="62" r="2.5" fill="#52525b" stroke="#71717a" strokeWidth="0.4"/>
        {/* Feet — heavy */}
        <rect x="30" y="74" width="16" height="4" rx="1.5" fill="#71717a" stroke="#a1a1aa" strokeWidth="0.3"/>
        <rect x="50" y="74" width="16" height="4" rx="1.5" fill="#71717a" stroke="#a1a1aa" strokeWidth="0.3"/>
        {/* Torso — massive chest */}
        <path d="M32 30 L34 24 L66 24 L68 30 L70 55 Q68 62 60 64 L40 64 Q32 62 30 55 Z" fill="url(#tm_metal)" stroke="#a1a1aa" strokeWidth="0.5"/>
        {/* Chest plate detail */}
        <path d="M38 28 L62 28 L60 50 L40 50 Z" fill="#52525b" stroke="#71717a" strokeWidth="0.3"/>
        {/* Core reactor — glowing */}
        <circle cx="50" cy="38" r="8" fill="url(#tm_core)"/>
        <circle cx="50" cy="38" r="6" fill="#0c4a6e" stroke="#0ea5e9" strokeWidth="0.8"/>
        <circle cx="50" cy="38" r="4" fill="#0ea5e9" opacity="0.7"/>
        <circle cx="50" cy="38" r="2" fill="#38bdf8"/>
        <circle cx="50" cy="38" r="1" fill="#bae6fd"/>
        <circle cx="49" cy="37" r="0.5" fill="white" opacity="0.6"/>
        {/* Reactor ring */}
        <circle cx="50" cy="38" r="10" fill="none" stroke="#0ea5e9" strokeWidth="0.3" opacity="0.3" strokeDasharray="2 2"/>
        {/* Head — angular helmet */}
        <path d="M40 24 L42 12 L46 8 L54 8 L58 12 L60 24 Z" fill="#a1a1aa" stroke="#d4d4d8" strokeWidth="0.4"/>
        <path d="M42 22 L44 14 L56 14 L58 22 Z" fill="#52525b"/>
        {/* Visor */}
        <rect x="43" y="16" width="14" height="4" rx="1" fill="#1e1b4b"/>
        <rect x="44" y="17" width="5" height="2" rx="0.5" fill="#f59e0b" opacity="0.8"/>
        <rect x="51" y="17" width="5" height="2" rx="0.5" fill="#f59e0b" opacity="0.8"/>
        {/* Antenna */}
        <line x1="50" y1="8" x2="50" y2="2" stroke="#a1a1aa" strokeWidth="1"/>
        <circle cx="50" cy="1" r="1.5" fill="#f59e0b"/>
        <circle cx="50" cy="1" r="0.6" fill="#fef3c7"/>
        {/* Shoulder armor — massive */}
        <path d="M30 28 Q22 24 16 26 Q12 30 14 38 L20 42 L30 36 Z" fill="#a1a1aa" stroke="#d4d4d8" strokeWidth="0.4"/>
        <path d="M70 28 Q78 24 84 26 Q88 30 86 38 L80 42 L70 36 Z" fill="#a1a1aa" stroke="#d4d4d8" strokeWidth="0.4"/>
        {/* Shoulder missiles/vents */}
        <circle cx="18" cy="30" r="2" fill="#52525b" stroke="#71717a" strokeWidth="0.3"/>
        <circle cx="18" cy="30" r="0.8" fill="#f59e0b" opacity="0.5"/>
        <circle cx="82" cy="30" r="2" fill="#52525b" stroke="#71717a" strokeWidth="0.3"/>
        <circle cx="82" cy="30" r="0.8" fill="#f59e0b" opacity="0.5"/>
        {/* Arms — heavy */}
        <path d="M14 38 L10 44 L8 52 L12 56 L18 50 L20 42 Z" fill="#71717a" stroke="#a1a1aa" strokeWidth="0.3"/>
        <path d="M86 38 L90 44 L92 52 L88 56 L82 50 L80 42 Z" fill="#71717a" stroke="#a1a1aa" strokeWidth="0.3"/>
        {/* Fists — cannon shaped */}
        <rect x="4" y="52" width="12" height="8" rx="2" fill="#52525b" stroke="#71717a" strokeWidth="0.3"/>
        <rect x="84" y="52" width="12" height="8" rx="2" fill="#52525b" stroke="#71717a" strokeWidth="0.3"/>
        <circle cx="4" cy="56" r="2" fill="#3f3f46" stroke="#71717a" strokeWidth="0.3"/>
        <circle cx="96" cy="56" r="2" fill="#3f3f46" stroke="#71717a" strokeWidth="0.3"/>
        {/* Exhaust vents on back */}
        <path d="M36 24 L32 18 L34 24" fill="#d97706" opacity="0.3"/>
        <path d="M64 24 L68 18 L66 24" fill="#d97706" opacity="0.3"/>
        {/* Energy lines on body */}
        <line x1="42" y1="50" x2="42" y2="58" stroke="#0ea5e9" strokeWidth="0.3" opacity="0.3"/>
        <line x1="58" y1="50" x2="58" y2="58" stroke="#0ea5e9" strokeWidth="0.3" opacity="0.3"/>
        <circle cx="42" cy="54" r="0.6" fill="#38bdf8" opacity="0.4"/>
        <circle cx="58" cy="54" r="0.6" fill="#38bdf8" opacity="0.4"/>
        {/* Sparks from joints */}
        <circle cx="22" cy="44" r="0.5" fill="#f59e0b" opacity="0.4"/>
        <circle cx="78" cy="44" r="0.5" fill="#f59e0b" opacity="0.3"/>
        <circle cx="36" cy="72" r="0.4" fill="#f59e0b" opacity="0.3"/>
        <circle cx="64" cy="72" r="0.4" fill="#f59e0b" opacity="0.3"/>
      </>
    ),
  },
};

// ── Component ───────────────────────────────────────────────────────────────

interface NexusClashCardProps {
  card: string | NcCardDef;
  compact?: boolean;
  onClick?: () => void;
  selected?: boolean;
  pending?: boolean;
  displayPower?: number;
  disabled?: boolean;
  faceDown?: boolean;
  locked?: boolean;
  showNew?: boolean;
  className?: string;
}

export function NexusClashCard({
  card,
  compact = false,
  onClick,
  selected = false,
  pending = false,
  displayPower,
  disabled = false,
  faceDown = false,
  locked = false,
  showNew = false,
  className = '',
}: NexusClashCardProps) {
  const { t } = useI18n();
  const def: NcCardDef | undefined = typeof card === 'string' ? NC_CARD_MAP[card] : card;

  const abilityDesc = useMemo(() => {
    if (!def) return '';
    return t(`nc.ability.${def.id}`) || '';
  }, [def, t]);

  if (!def) return null;

  const power = displayPower ?? def.power;
  const isPowerBuffed = displayPower !== undefined && displayPower > def.power;
  const isPowerDebuffed = displayPower !== undefined && displayPower < def.power;
  const art = CARD_ART[def.id];

  if (faceDown) {
    return (
      <div
        className={[
          'relative flex items-center justify-center overflow-hidden',
          compact ? 'w-12 h-16 rounded' : 'w-28 h-40 rounded-lg',
          className,
        ].join(' ')}
        style={{
          background: 'linear-gradient(135deg, #1a1a2e, #12121f)',
          border: '2px solid #2a2a3a',
        }}
      >
        <div className={[
          'font-black',
          compact ? 'text-lg' : 'text-2xl',
        ].join(' ')} style={{ color: '#2a2a3a' }}>?</div>
        {/* Ornamental pattern */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(201,168,76,0.03) 4px, rgba(201,168,76,0.03) 8px)',
        }} />
        {/* Center diamond */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg viewBox="0 0 20 20" className={compact ? 'w-4 h-4' : 'w-6 h-6'} style={{ opacity: 0.15 }}>
            <polygon points="10,2 18,10 10,18 2,10" fill="#c9a84c"/>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={[
        'relative transition-all duration-200 select-none group overflow-hidden',
        compact ? 'w-12 h-16 rounded text-[10px]' : 'w-28 h-40 rounded-lg',
        onClick && !disabled ? 'cursor-pointer hover:scale-105 hover:-translate-y-1' : '',
        selected ? 'scale-105 -translate-y-1' : '',
        pending ? 'opacity-60' : '',
        disabled ? 'opacity-40 grayscale cursor-not-allowed' : '',
        locked ? 'opacity-30 grayscale' : '',
        def.rarity === 'legendary' ? 'nc-legendary-pulse' : '',
        def.rarity === 'epic' ? 'nc-epic-shimmer' : '',
        className,
      ].join(' ')}
      style={{
        background: RARITY_BG[def.rarity],
        border: `2px solid ${selected ? '#c9a84c' : RARITY_BORDER[def.rarity]}`,
        boxShadow: selected
          ? `0 0 20px ${RARITY_BORDER[def.rarity]}88, ${RARITY_GLOW[def.rarity]}`
          : RARITY_GLOW[def.rarity],
      }}
      title={!compact ? `${t(def.nameKey)} - ${abilityDesc}` : undefined}
    >
      {/* Double-border inner frame */}
      <div className="absolute inset-[2px] pointer-events-none rounded" style={{
        border: `1px solid ${RARITY_BORDER[def.rarity]}22`,
      }} />

      {/* Corner accents for rare+ */}
      {def.rarity !== 'common' && !compact && (
        <>
          <div className="absolute top-0 left-0 w-2.5 h-2.5 pointer-events-none" style={{
            borderTop: `1px solid ${RARITY_BORDER[def.rarity]}66`,
            borderLeft: `1px solid ${RARITY_BORDER[def.rarity]}66`,
          }} />
          <div className="absolute top-0 right-0 w-2.5 h-2.5 pointer-events-none" style={{
            borderTop: `1px solid ${RARITY_BORDER[def.rarity]}66`,
            borderRight: `1px solid ${RARITY_BORDER[def.rarity]}66`,
          }} />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 pointer-events-none" style={{
            borderBottom: `1px solid ${RARITY_BORDER[def.rarity]}66`,
            borderLeft: `1px solid ${RARITY_BORDER[def.rarity]}66`,
          }} />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 pointer-events-none" style={{
            borderBottom: `1px solid ${RARITY_BORDER[def.rarity]}66`,
            borderRight: `1px solid ${RARITY_BORDER[def.rarity]}66`,
          }} />
        </>
      )}

      {/* Cost gem (top-left) — hexagonal shape */}
      <div className={[
        'absolute flex items-center justify-center font-black text-white z-10',
        compact ? '-top-1 -left-1 w-4 h-4 text-[9px]' : '-top-1.5 -left-1.5 w-7 h-7 text-xs',
      ].join(' ')}>
        <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full">
          <polygon points="12,1 22,7 22,17 12,23 2,17 2,7" fill="url(#none)" style={{ fill: 'unset' }}/>
          <polygon points="12,1 22,7 22,17 12,23 2,17 2,7"
            fill={def.rarity === 'legendary' ? '#a07c2a' : def.rarity === 'epic' ? '#5b21b6' : def.rarity === 'rare' ? '#2a4aaa' : '#2a2a3a'}
            stroke={RARITY_BORDER[def.rarity]}
            strokeWidth="1.5"
          />
        </svg>
        <span className="relative z-10">{def.cost}</span>
      </div>

      {/* Card content */}
      <div className={[
        'h-full flex flex-col',
        compact ? 'gap-0 p-1' : 'gap-0',
      ].join(' ')}>

        {/* Art Panel (full mode) */}
        {!compact && art && (
          <div className="relative mx-1.5 mt-4 rounded overflow-hidden" style={{ height: '50%' }}>
            <div className="absolute inset-0" style={{ background: art.bg }} />
            <svg viewBox="0 0 100 85" className="relative w-full h-full" preserveAspectRatio="xMidYMid meet">
              {art.svg}
            </svg>
            {/* Vignette */}
            <div className="absolute inset-0" style={{
              boxShadow: 'inset 0 0 12px rgba(0,0,0,0.6)',
            }} />
            {/* Top edge highlight */}
            <div className="absolute top-0 left-0 right-0 h-px" style={{
              background: `linear-gradient(to right, transparent, ${RARITY_BORDER[def.rarity]}44, transparent)`,
            }} />
          </div>
        )}

        {/* Compact art */}
        {compact && art && (
          <div className="relative mx-0.5 mt-2.5 rounded overflow-hidden" style={{ height: '40%' }}>
            <div className="absolute inset-0" style={{ background: art.bg }} />
            <svg viewBox="0 0 100 85" className="relative w-full h-full" preserveAspectRatio="xMidYMid meet">
              {art.svg}
            </svg>
          </div>
        )}

        {/* Name */}
        {!compact && (
          <p className="text-[9px] font-bold leading-tight truncate px-1.5 mt-1" style={{ color: '#e0e0e8' }}>
            {t(def.nameKey)}
          </p>
        )}

        {/* Tags */}
        {!compact && (
          <div className="flex gap-0.5 flex-wrap px-1.5">
            {def.tags.map((tag) => (
              <span key={tag} title={t(`nc.tag.${tag}`)}>
                {TAG_ICONS[tag]}
              </span>
            ))}
          </div>
        )}

        {/* Ability text */}
        {!compact && (
          <p className="text-[7px] leading-tight line-clamp-2 px-1.5" style={{ color: '#7a7a8a' }}>
            {abilityDesc}
          </p>
        )}

        {/* Compact: tags */}
        {compact && (
          <div className="flex gap-px justify-center">
            {def.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[7px]">{TAG_ICONS[tag]}</span>
            ))}
          </div>
        )}
      </div>

      {/* Power (bottom-right) — shield shape */}
      <div className={[
        'absolute flex items-center justify-center font-black z-10',
        compact ? '-bottom-1 -right-1 w-4 h-4 text-[9px]' : '-bottom-1.5 -right-1.5 w-7 h-7 text-xs',
      ].join(' ')}>
        <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full">
          <path d="M12 2L20 6V14C20 18 16 22 12 23C8 22 4 18 4 14V6L12 2Z"
            fill={isPowerBuffed ? '#166534' : isPowerDebuffed ? '#7f1d1d' : '#2a2a3a'}
            stroke={isPowerBuffed ? '#22c55e' : isPowerDebuffed ? '#ef4444' : '#4a4a5a'}
            strokeWidth="1.5"
          />
        </svg>
        <span className="relative z-10" style={{
          color: isPowerBuffed ? '#4ade80' : isPowerDebuffed ? '#fca5a5' : '#e0e0e8',
        }}>
          {power}
        </span>
      </div>

      {/* NEW badge */}
      {showNew && (
        <div className="absolute -top-2 -right-2 text-[8px] font-black px-1.5 py-0.5 rounded z-20 animate-bounce" style={{
          background: '#c9a84c',
          color: '#0a0a12',
          boxShadow: '0 0 8px rgba(201,168,76,0.5)',
        }}>
          NEU!
        </div>
      )}

      {/* Lock icon */}
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#4a4a5a" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
      )}

      {/* Rare+ shimmer overlay */}
      {def.rarity !== 'common' && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `linear-gradient(135deg, transparent 40%, ${RARITY_BORDER[def.rarity]}08 50%, transparent 60%)`,
        }} />
      )}
    </div>
  );
}
