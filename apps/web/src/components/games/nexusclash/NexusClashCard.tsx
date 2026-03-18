'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  legendary: 'linear-gradient(180deg, #1f1a08, #15100a, #0e0a06)',
};

const RARITY_GLOW: Record<NcRarity, string> = {
  common:    'none',
  rare:      '0 0 8px rgba(74,125,255,0.2)',
  epic:      '0 0 12px rgba(124,58,237,0.3)',
  legendary: '0 0 20px rgba(201,168,76,0.5), 0 0 40px rgba(201,168,76,0.15)',
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
  spell: <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M6 1L7 4L6 3.5L5 4Z" fill="#e879f9" opacity="0.9"/><path d="M6 3.5L6 9" stroke="#e879f9" strokeWidth="1" strokeLinecap="round"/><circle cx="6" cy="9.5" r="1" fill="none" stroke="#e879f9" strokeWidth="0.6"/><path d="M4 5.5L8 5.5" stroke="#e879f9" strokeWidth="0.6" opacity="0.6"/></svg>,
  dragon: <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M2 9C2 9 3 5 6 3C9 5 10 9 10 9" fill="none" stroke="#ef4444" strokeWidth="1" strokeLinecap="round"/><path d="M4 3L3 1M8 3L9 1" stroke="#ef4444" strokeWidth="0.8" strokeLinecap="round" opacity="0.7"/><circle cx="4.5" cy="5.5" r="0.6" fill="#fbbf24"/><circle cx="7.5" cy="5.5" r="0.6" fill="#fbbf24"/><path d="M5 7.5L6 7L7 7.5" fill="none" stroke="#ef4444" strokeWidth="0.5"/></svg>,
  demon: <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M3 3L4.5 5.5M9 3L7.5 5.5" stroke="#dc2626" strokeWidth="0.8" strokeLinecap="round"/><circle cx="6" cy="7" r="3" fill="none" stroke="#dc2626" strokeWidth="0.8"/><circle cx="4.8" cy="6.5" r="0.7" fill="#dc2626"/><circle cx="7.2" cy="6.5" r="0.7" fill="#dc2626"/><path d="M4.5 8.5Q6 9.5 7.5 8.5" fill="none" stroke="#dc2626" strokeWidth="0.5"/></svg>,
  relic: <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M6 1.5L8 4.5H10L8 6.5L9 10L6 8L3 10L4 6.5L2 4.5H4Z" fill="none" stroke="#d97706" strokeWidth="0.8"/><circle cx="6" cy="5.5" r="1.5" fill="#d97706" opacity="0.5"/></svg>,
};

// ── Card Art Definitions ────────────────────────────────────────────────────

interface CardArt {
  bg: string; // CSS gradient for art panel background
  svg: React.ReactNode; // SVG content (children of <svg>)
  img?: string; // Optional PNG path — used instead of svg when set
}

const CARD_ART: Record<string, CardArt> = {
  // ── Commons ──
  schildbot: {
    bg: 'none',
    svg: null,
    img: '/cards/schildbot.png',
  },
  aufklaerer: {
    bg: 'none',
    svg: null,
    img: '/cards/aufklaerer.png',
  },
  skelett_horde: {
    bg: 'none',
    svg: null,
    img: '/cards/skelett_horde.png',
  },
  druidin: {
    bg: 'none',
    svg: null,
    img: '/cards/druidin.png',
  },
  hermes: {
    bg: 'none',
    svg: null,
    img: '/cards/hermes.png',
  },
  verzauberin: {
    bg: 'none',
    svg: null,
    img: '/cards/verzauberin.png',
  },
  hydra: {
    bg: 'none',
    svg: null,
    img: '/cards/hydra.png',
  },
  leerenmagier: {
    bg: 'none',
    svg: null,
    img: '/cards/leerenmagier.png',
  },
  assassine: {
    bg: 'none',
    svg: null,
    img: '/cards/assassine.png',
  },
  paladin: {
    bg: 'none',
    svg: null,
    img: '/cards/paladin.png',
  },
  // ── Rares ──
  apollo: {
    bg: 'none',
    svg: null,
    img: '/cards/apollo.png',
  },
  greif: {
    bg: 'none',
    svg: null,
    img: '/cards/greif.png',
  },
  energiekern: {
    bg: 'none',
    svg: null,
    img: '/cards/energiekern.png',
  },
  athena: {
    bg: 'none',
    svg: null,
    img: '/cards/athena.png',
  },
  phoenix: {
    bg: 'none',
    svg: null,
    img: '/cards/phoenix.png',
  },
  erzmagier: {
    bg: 'none',
    svg: null,
    img: '/cards/erzmagier.png',
  },
  kriegsherr: {
    bg: 'none',
    svg: null,
    img: '/cards/kriegsherr.png',
  },
  seelendieb: {
    bg: 'none',
    svg: null,
    img: '/cards/seelendieb.png',
  },
  // ── Epics ──
  treant: {
    bg: 'none',
    svg: null,
    img: '/cards/treant.png',
  },
  lichkoenig: {
    bg: 'none',
    svg: null,
    img: '/cards/lichkoenig.png',
  },
  zeus: {
    bg: 'none',
    svg: null,
    img: '/cards/zeus.png',
  },
  fenrir: {
    bg: 'none',
    svg: null,
    img: '/cards/fenrir.png',
  },
  // ── Legendary ──
  titan_mk3: {
    bg: 'none',
    svg: null,
    img: '/cards/titan_mk3.png',
  },

  // ── New Commons ──
  nebelkrieger: {
    bg: 'none',
    svg: null,
    img: '/cards/nebelkrieger.png',
  },
  lichtbringer: {
    bg: 'none',
    svg: null,
    img: '/cards/lichtbringer.png',
  },
  wurzelgolem: {
    bg: 'none',
    svg: null,
    img: '/cards/wurzelgolem.png',
  },

  // ── New Rares ──
  frostriese: {
    bg: 'none',
    svg: null,
    img: '/cards/frostriese.png',
  },
  zeitweber: {
    bg: 'none',
    svg: null,
    img: '/cards/zeitweber.png',
  },
  koenigsgarde: {
    bg: 'none',
    svg: null,
    img: '/cards/koenigsgarde.png',
  },

  // ── New Epics ──
  valkyria: {
    bg: 'none',
    svg: null,
    img: '/cards/valkyria.png',
  },
  schattenjaeger: {
    bg: 'none',
    svg: null,
    img: '/cards/schattenjaeger.png',
  },
  weltenbaum: {
    bg: 'none',
    svg: null,
    img: '/cards/weltenbaum.png',
  },

  // ── New Legendaries ──
  odin: {
    bg: 'none',
    svg: null,
    img: '/cards/odin.png',
  },
  mechanicus: {
    bg: 'none',
    svg: null,
    img: '/cards/mechanicus.png',
  },
  nyx: {
    bg: 'none',
    svg: null,
    img: '/cards/nyx.png',
  },
  geisterjunge: {
    bg: 'none',
    svg: null,
    img: '/cards/geisterjunge.png',
  },
  waldlaeufer: {
    bg: 'none',
    svg: null,
    img: '/cards/waldlaeufer.png',
  },

  // ── Spells ──
  feuersturm: { bg: 'none', svg: null, img: '/cards/feuersturm.png' },
  eisschild: {
    bg: 'none',
    svg: null,
    img: '/cards/eisschild.png',
  },
  blitzschlag: {
    bg: 'none',
    svg: null,
    img: '/cards/blitzschlag.png',
  },
  seelenbrand: { bg: 'none', svg: null, img: '/cards/seelenbrand.png' },
  dimensionsriss: { bg: 'none', svg: null, img: '/cards/dimensionsriss.png' },
  zeitstillstand: { bg: 'none', svg: null, img: '/cards/zeitstillstand.png' },
  arkanexplosion: {
    bg: 'none',
    svg: null,
    img: '/cards/arkanexplosion.png',
  },
  weltensturm: { bg: 'none', svg: null, img: '/cards/weltensturm.png' },
  goetterdaemmerung: {
    bg: 'none',
    svg: null,
    img: '/cards/goetterdaemmerung.png',
  },

  // ── Dragons ──
  jungdrache: { bg: 'none', svg: null, img: '/cards/jungdrache.png' },
  drachenschuppe: { bg: 'none', svg: null, img: '/cards/drachenschuppe.png' },
  feuerodem: { bg: 'none', svg: null, img: '/cards/feuerodem.png' },
  sturmdrache: { bg: 'none', svg: null, img: '/cards/sturmdrache.png' },
  drachenhort: { bg: 'none', svg: null, img: '/cards/drachenhort.png' },
  uralter_wyrm: { bg: 'none', svg: null, img: '/cards/uralter_wyrm.png' },
  bahamut: { bg: 'none', svg: null, img: '/cards/bahamut.png' },

  // ── Demons ──
  imp: { bg: 'none', svg: null, img: '/cards/imp.png' },
  hoellenhund: { bg: 'none', svg: null, img: '/cards/hoellenhund.png' },
  schattendaemon: { bg: 'none', svg: null, img: '/cards/schattendaemon.png' },
  sukubus: { bg: 'none', svg: null, img: '/cards/sukubus.png' },
  hoellenfuerst: { bg: 'none', svg: null, img: '/cards/hoellenfuerst.png' },
  erzdaemon: { bg: 'none', svg: null, img: '/cards/erzdaemon.png' },
  abaddon: { bg: 'none', svg: null, img: '/cards/abaddon.png' },

  // ── Relics ──
  runenstein: { bg: 'none', svg: null, img: '/cards/runenstein.png' },
  schutztalisman: { bg: 'none', svg: null, img: '/cards/schutztalisman.png' },
  kriegshorn: { bg: 'none', svg: null, img: '/cards/kriegshorn.png' },
  seelengefaess: { bg: 'none', svg: null, img: '/cards/seelengefaess.png' },
  machtkrone: { bg: 'none', svg: null, img: '/cards/machtkrone.png' },
  schicksalsklinge: { bg: 'none', svg: null, img: '/cards/schicksalsklinge.png' },
  // ── Battle Pass Exclusives ──
  'nexuswächter': { bg: 'none', svg: null, img: '/cards/nexuswaechter.png' },
  chronokaiser: { bg: 'none', svg: null, img: '/cards/chronokaiser.png' },
  weltenamboss: { bg: 'none', svg: null, img: '/cards/weltenamboss.png' },
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
  showPreview?: boolean;
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
  showPreview = true,
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

  // ── Hover preview ──────────────────────────────────────────────────────────
  const [showHoverPreview, setShowHoverPreview] = useState(false);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (compact || faceDown || !showPreview) return;
    hoverTimer.current = setTimeout(() => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const previewW = 200;
        const previewH = 380;
        const x = rect.right + 12 + previewW > window.innerWidth
          ? rect.left - previewW - 12
          : rect.right + 12;
        const y = Math.max(8, Math.min(rect.top, window.innerHeight - previewH - 8));
        setPreviewPos({ x, y });
      }
      setShowHoverPreview(true);
    }, 400);
  }, [compact, faceDown, showPreview]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setShowHoverPreview(false);
  }, []);

  const isLegendary = def.rarity === 'legendary';

  const previewPortal = showHoverPreview && !compact && !faceDown && typeof window !== 'undefined'
    ? createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: previewPos.x,
            top: previewPos.y,
            animation: isLegendary ? 'nc-legendary-preview-enter 300ms ease-out' : 'nc-preview-fade-in 150ms ease-out',
          }}
        >
          <style>{`
            @keyframes nc-preview-fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            @keyframes nc-legendary-preview-enter {
              0% { opacity: 0; transform: scale(0.8) rotate(-2deg); filter: brightness(2); }
              60% { opacity: 1; transform: scale(1.03) rotate(0.5deg); filter: brightness(1.3); }
              100% { opacity: 1; transform: scale(1) rotate(0deg); filter: brightness(1); }
            }
          `}</style>

          {/* Outer legendary aura */}
          {isLegendary && (
            <div className="absolute -inset-3 rounded-2xl nc-legendary-preview-aura" style={{
              background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.25) 0%, rgba(201,168,76,0.08) 40%, transparent 70%)',
              filter: 'blur(8px)',
              zIndex: -1,
            }} />
          )}

          <div className="relative" style={{ width: isLegendary ? 240 : 200 }}>
            {/* Animated conic border for legendary */}
            {isLegendary && (
              <div className="absolute -inset-[3px] rounded-[14px] nc-legendary-conic-border" />
            )}

            <div className={[
              'relative flex flex-col overflow-hidden',
              isLegendary ? 'nc-legendary-pulse' : '',
            ].join(' ')} style={{
              background: isLegendary
                ? 'linear-gradient(180deg, #1f1a08 0%, #15100a 40%, #0e0a06 100%)'
                : RARITY_BG[def.rarity],
              border: isLegendary ? '2px solid #d4af37' : `2px solid ${RARITY_BORDER[def.rarity]}`,
              borderRadius: 12,
              boxShadow: isLegendary
                ? '0 0 30px rgba(201,168,76,0.6), 0 0 80px rgba(201,168,76,0.2), 0 16px 48px rgba(0,0,0,0.8)'
                : `${RARITY_GLOW[def.rarity]}, 0 8px 32px rgba(0,0,0,0.6)`,
            }}>
              {/* Art area */}
              <div className="relative" style={{ height: isLegendary ? 150 : 120, overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  background: art?.bg && art.bg !== 'none' ? art.bg : 'linear-gradient(180deg, #18182a, #0e0e1a)',
                }}>
                  {art?.img ? (
                    <img src={art.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : art?.svg ? (
                    <svg viewBox="0 0 100 85" style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
                      {art.svg}
                    </svg>
                  ) : null}
                </div>
                {/* Legendary holographic sweep + vignette */}
                {isLegendary && (
                  <>
                    <div className="nc-legendary-holo-sweep" style={{ position: 'absolute', inset: 0 }} />
                    <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 40px rgba(201,168,76,0.15), inset 0 -20px 30px rgba(0,0,0,0.5)' }} />
                    {/* Gold sparkle particles */}
                    <div style={{ position: 'absolute', inset: 0 }}>
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="nc-sparkle" style={{
                          left: `${10 + (i * 11)}%`,
                          top: `${8 + ((i * 31) % 75)}%`,
                          animationDelay: `${i * 0.3}s`,
                          animationDuration: `${1.5 + (i % 3) * 0.5}s`,
                        }} />
                      ))}
                    </div>
                  </>
                )}
                {/* Cost badge */}
                <div className="absolute top-2 left-2 flex items-center justify-center text-sm font-black" style={{
                  width: isLegendary ? 32 : 28,
                  height: isLegendary ? 32 : 28,
                  borderRadius: '50%',
                  background: isLegendary ? 'linear-gradient(135deg, #5a8fff, #2a4aaa)' : 'linear-gradient(135deg, #4a7dff, #2a4aaa)',
                  color: 'white',
                  boxShadow: isLegendary ? '0 2px 8px rgba(74,125,255,0.5), 0 0 12px rgba(74,125,255,0.3)' : '0 2px 6px rgba(0,0,0,0.5)',
                  fontSize: isLegendary ? 15 : 14,
                }}>
                  {def.cost}
                </div>
                {/* Power badge */}
                <div className="absolute top-2 right-2 flex items-center justify-center text-sm font-black" style={{
                  width: isLegendary ? 32 : 28,
                  height: isLegendary ? 32 : 28,
                  borderRadius: '50%',
                  background: isPowerBuffed ? 'linear-gradient(135deg, #22c55e, #166534)' : 'linear-gradient(135deg, #ef4444, #b91c1c)',
                  color: isPowerBuffed ? '#4ade80' : 'white',
                  boxShadow: isLegendary ? '0 2px 8px rgba(239,68,68,0.5), 0 0 12px rgba(239,68,68,0.3)' : '0 2px 6px rgba(0,0,0,0.5)',
                  fontSize: isLegendary ? 15 : 14,
                }}>
                  {power}
                </div>
              </div>

              {/* Legendary gold separator */}
              {isLegendary && (
                <div style={{
                  height: 2,
                  background: 'linear-gradient(to right, transparent, #c9a84c88, #ffd70066, #c9a84c88, transparent)',
                }} />
              )}

              {/* Info area */}
              <div className="flex flex-col gap-1.5" style={{
                padding: isLegendary ? '12px 14px' : '12px',
                background: isLegendary ? 'linear-gradient(180deg, rgba(20,16,8,0.95), rgba(14,10,6,0.98))' : 'rgba(14,14,26,0.9)',
              }}>
                {/* Name */}
                <p style={{
                  fontSize: isLegendary ? 15 : 14,
                  fontWeight: 800,
                  color: isLegendary ? '#e8d48b' : RARITY_BORDER[def.rarity],
                  textShadow: isLegendary ? '0 0 12px rgba(201,168,76,0.4)' : 'none',
                  letterSpacing: isLegendary ? '0.03em' : 'normal',
                }}>
                  {t(def.nameKey)}
                </p>
                {/* Tags */}
                <div className="flex gap-1 flex-wrap">
                  {def.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full" style={{
                      background: isLegendary ? 'rgba(201,168,76,0.08)' : '#1a1a2e',
                      border: isLegendary ? '1px solid rgba(201,168,76,0.2)' : '1px solid #2a2a3a',
                      color: isLegendary ? '#c9a84c' : '#8a8a9a',
                    }}>
                      {TAG_ICONS[tag]}
                      {t(`nc.tag.${tag}`)}
                    </span>
                  ))}
                </div>
                {/* Ability */}
                <p style={{
                  fontSize: isLegendary ? 12 : 11,
                  lineHeight: 1.5,
                  color: isLegendary ? '#b8a87a' : '#9a9aaa',
                }}>
                  {abilityDesc}
                </p>
                {/* Lore */}
                <p style={{
                  fontSize: 9,
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                  color: isLegendary ? '#8a7a5a' : '#5a5a6a',
                  borderTop: `1px solid ${isLegendary ? 'rgba(201,168,76,0.15)' : '#1a1a2e'}`,
                  paddingTop: 6,
                  marginTop: 2,
                }}>
                  {t(`nc.lore.${def.id}`)}
                </p>
                {/* Rarity */}
                <div className="flex items-center gap-1.5">
                  {isLegendary && (
                    <svg viewBox="0 0 12 12" className="w-3 h-3">
                      <polygon points="6,0.5 7.5,4 11.5,4 8.5,6.5 9.5,10.5 6,8 2.5,10.5 3.5,6.5 0.5,4 4.5,4" fill="#c9a84c"/>
                    </svg>
                  )}
                  <span style={{
                    fontSize: 9,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    fontWeight: 700,
                    color: isLegendary ? '#c9a84c' : RARITY_BORDER[def.rarity] + '88',
                  }}>
                    {t(`nc.rarity.${def.rarity}`)}
                  </span>
                  {isLegendary && (
                    <svg viewBox="0 0 12 12" className="w-3 h-3">
                      <polygon points="6,0.5 7.5,4 11.5,4 8.5,6.5 9.5,10.5 6,8 2.5,10.5 3.5,6.5 0.5,4 4.5,4" fill="#c9a84c"/>
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

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
    <>
    <div
      ref={cardRef}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={[
        'relative transition-all duration-200 select-none group overflow-hidden',
        compact ? 'w-12 h-16 rounded text-[10px]' : 'w-28 h-40 rounded-lg',
        onClick && !disabled ? 'cursor-pointer hover:scale-105 hover:-translate-y-1' : '',
        selected ? 'scale-105 -translate-y-1' : '',
        pending ? 'opacity-60' : '',
        disabled ? 'opacity-40 grayscale cursor-not-allowed' : '',
        locked ? 'opacity-30 grayscale' : '',
        def.rarity === 'legendary' ? 'nc-legendary-pulse nc-card-shine nc-card-legendary-holo' : '',
        def.rarity === 'epic' ? 'nc-epic-shimmer nc-card-shine nc-card-epic-holo' : '',
        def.rarity === 'rare' ? 'nc-card-shine' : '',
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
            fill="#1a3a6a"
            stroke="#4a7dff"
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
            {art.img ? (
              <img src={art.img} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover' }} />
            ) : (
              <>
                <div className="absolute inset-0" style={{ background: art.bg }} />
                <svg viewBox="0 0 100 85" className="relative w-full h-full" preserveAspectRatio="xMidYMid meet">
                  {art.svg}
                </svg>
              </>
            )}
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
            {art.img ? (
              <img src={art.img} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover' }} />
            ) : (
              <>
                <div className="absolute inset-0" style={{ background: art.bg }} />
                <svg viewBox="0 0 100 85" className="relative w-full h-full" preserveAspectRatio="xMidYMid meet">
                  {art.svg}
                </svg>
              </>
            )}
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
          <div className="flex gap-0.5 flex-wrap px-1.5 items-center">
            {def.tags.map((tag, i) => (
              <span key={tag} title={t(`nc.tag.${tag}`)} style={i === 0 ? {
                filter: 'brightness(1.4)',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: '3px',
                padding: '1px 2px',
              } : { opacity: 0.55, padding: '1px 2px' }}>
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
            fill={isPowerBuffed ? '#166534' : isPowerDebuffed ? '#7f1d1d' : '#6a1a1a'}
            stroke={isPowerBuffed ? '#22c55e' : isPowerDebuffed ? '#ef4444' : '#ef4444'}
            strokeWidth="1.5"
          />
        </svg>
        <span className="relative z-10" style={{
          color: isPowerBuffed ? '#4ade80' : isPowerDebuffed ? '#fca5a5' : '#ffffff',
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
      {(def.rarity === 'rare' || def.rarity === 'epic') && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `linear-gradient(135deg, transparent 40%, ${RARITY_BORDER[def.rarity]}08 50%, transparent 60%)`,
        }} />
      )}

      {/* Legendary holographic effect */}
      {def.rarity === 'legendary' && !compact && (
        <>
          {/* Animated holographic sweep */}
          <div className="absolute inset-0 pointer-events-none nc-legendary-holo-sweep" />
          {/* Gold particle sparkles */}
          <div className="absolute inset-0 pointer-events-none nc-legendary-sparkles">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="nc-sparkle" style={{
                left: `${15 + (i * 14)}%`,
                top: `${10 + ((i * 37) % 70)}%`,
                animationDelay: `${i * 0.4}s`,
              }} />
            ))}
          </div>
          {/* Inner gold emboss frame */}
          <div className="absolute inset-[3px] pointer-events-none rounded" style={{
            border: '1px solid rgba(201,168,76,0.2)',
            boxShadow: 'inset 0 0 12px rgba(201,168,76,0.08)',
          }} />
          {/* Animated border glow */}
          <div className="absolute inset-0 pointer-events-none nc-legendary-border-glow rounded-lg" />
        </>
      )}

      {/* Legendary compact glow */}
      {def.rarity === 'legendary' && compact && (
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'linear-gradient(135deg, transparent 30%, rgba(201,168,76,0.1) 50%, transparent 70%)',
        }} />
      )}
    </div>
    {previewPortal}
    </>
  );
}
