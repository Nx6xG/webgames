// ── Name Color Registry ──────────────────────────────────────────────────────

export interface NameColorDef {
  id: string;
  className: string;
  labelKey: string;
}

export const NAME_COLOR_PALETTE: NameColorDef[] = [
  { id: 'red',     className: 'text-red-400',     labelKey: 'color.red' },
  { id: 'orange',  className: 'text-orange-400',  labelKey: 'color.orange' },
  { id: 'amber',   className: 'text-amber-400',   labelKey: 'color.amber' },
  { id: 'yellow',  className: 'text-yellow-400',  labelKey: 'color.yellow' },
  { id: 'lime',    className: 'text-lime-400',     labelKey: 'color.lime' },
  { id: 'emerald', className: 'text-emerald-400', labelKey: 'color.emerald' },
  { id: 'cyan',    className: 'text-cyan-400',    labelKey: 'color.cyan' },
  { id: 'sky',     className: 'text-sky-400',     labelKey: 'color.sky' },
  { id: 'indigo',  className: 'text-indigo-400',  labelKey: 'color.indigo' },
  { id: 'violet',  className: 'text-violet-400',  labelKey: 'color.violet' },
  { id: 'pink',    className: 'text-pink-400',    labelKey: 'color.pink' },
  { id: 'rose',    className: 'text-rose-400',    labelKey: 'color.rose' },
];

const colorMap = new Map(NAME_COLOR_PALETTE.map((c) => [c.id, c.className]));

export const NAME_COLOR_KEY = 'wg_name_color';

export function getStoredNameColor(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem(NAME_COLOR_KEY) || undefined;
}

export function setStoredNameColor(color: string | undefined): void {
  if (typeof window === 'undefined') return;
  if (color) {
    localStorage.setItem(NAME_COLOR_KEY, color);
  } else {
    localStorage.removeItem(NAME_COLOR_KEY);
  }
}

/** Returns the Tailwind class for a color ID, or '' for default/unknown. */
export function getNameColorClass(colorId?: string): string {
  if (!colorId) return '';
  return colorMap.get(colorId) ?? '';
}
