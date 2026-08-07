import type { CosmeticsSelection } from 'shared';

/** Flat profile-ish shape used by rooms, presence, and chat profiles. */
export interface CosmeticsFields {
  avatarId?: string;
  nameColor?: string;
  avatarFrame?: string;
  banner?: string;
  cardColor?: string;
  badges?: string[];
}

export function buildCosmetics(p: CosmeticsFields): CosmeticsSelection {
  return { avatarId: p.avatarId, nameColor: p.nameColor, slots: { frame: p.avatarFrame, banner: p.banner, cardColor: p.cardColor }, badges: p.badges };
}

export function applyCosmetics(target: CosmeticsFields, c?: CosmeticsSelection) {
  if (!c) return;
  if (c.avatarId !== undefined) target.avatarId = c.avatarId;
  if (c.nameColor !== undefined) target.nameColor = c.nameColor;
  if (c.slots?.frame !== undefined) target.avatarFrame = c.slots.frame;
  if (c.slots?.banner !== undefined) target.banner = c.slots.banner;
  if (c.slots?.cardColor !== undefined) target.cardColor = c.slots.cardColor;
  if (c.badges !== undefined) target.badges = c.badges;
}
