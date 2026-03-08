'use client';

import { useId } from 'react';

/**
 * Premium in-game currency token — clean platinum coin, no text.
 * Concentric rings + central diamond facet.
 */

const SIZE_MAP = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 28,
  xl: 36,
} as const;

type TokenSize = keyof typeof SIZE_MAP;

interface Props {
  size?: TokenSize;
  className?: string;
}

export function TokenIcon({ size = 'sm', className = '' }: Props) {
  const uid = useId();
  const px = SIZE_MAP[size];

  const face = `a${uid}`;
  const rim = `b${uid}`;
  const hi = `c${uid}`;
  const glow = `d${uid}`;
  const inner = `e${uid}`;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <filter id={glow} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
        </filter>

        {/* Face — platinum with strong contrast */}
        <radialGradient id={face} cx="0.4" cy="0.33" r="0.6">
          <stop offset="0%" stopColor="#e8ecf4" />
          <stop offset="35%" stopColor="#a8b1c4" />
          <stop offset="70%" stopColor="#5c6580" />
          <stop offset="100%" stopColor="#2e3444" />
        </radialGradient>

        {/* Rim */}
        <linearGradient id={rim} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a4050" />
          <stop offset="100%" stopColor="#14181f" />
        </linearGradient>

        {/* Specular */}
        <radialGradient id={hi} cx="0.36" cy="0.3" r="0.2">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>

        {/* Inner vignette */}
        <radialGradient id={inner} cx="0.5" cy="0.52" r="0.5">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#0a0d13" stopOpacity="0.45" />
        </radialGradient>
      </defs>

      {/* Glow */}
      <circle cx="18" cy="18" r="12" fill="#8891a5" opacity="0.15" filter={`url(#${glow})`} />

      {/* Rim */}
      <circle cx="18" cy="19" r="14.5" fill={`url(#${rim})`} />

      {/* Face */}
      <circle cx="18" cy="17.5" r="14" fill={`url(#${face})`} />

      {/* Vignette */}
      <circle cx="18" cy="17.5" r="14" fill={`url(#${inner})`} />

      {/* Top bevel */}
      <path d="M5 14a13.5 13.5 0 0 1 26 0" fill="none" stroke="#dde1ec" strokeWidth="0.8" opacity="0.5" />

      {/* Outer ring */}
      <circle cx="18" cy="17.5" r="11" fill="none" stroke="#2e3444" strokeWidth="1.2" opacity="0.7" />
      <circle cx="18" cy="17.3" r="11" fill="none" stroke="#a8b1c4" strokeWidth="0.4" opacity="0.3" />

      {/* Inner ring */}
      <circle cx="18" cy="17.5" r="7.5" fill="none" stroke="#2e3444" strokeWidth="0.8" opacity="0.5" />
      <circle cx="18" cy="17.3" r="7.5" fill="none" stroke="#a8b1c4" strokeWidth="0.3" opacity="0.25" />

      {/* Center diamond facet */}
      <path d="M18 13 L22 17.5 L18 22 L14 17.5 Z" fill="#c0c8d8" opacity="0.35" />
      <path d="M18 13 L22 17.5 L18 22 L14 17.5 Z" fill="none" stroke="#e0e4ee" strokeWidth="0.8" opacity="0.5" />

      {/* Specular */}
      <circle cx="18" cy="17.5" r="14" fill={`url(#${hi})`} />
    </svg>
  );
}
