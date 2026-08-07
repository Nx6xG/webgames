import type { PresenceActivity, ProfileShowcase } from 'shared';
import type { GameServer } from './serverTypes.js';
import { buildCosmetics } from './cosmetics.js';

export interface PresenceEntry {
  nickname: string;
  avatarId?: string;
  nameColor?: string;
  avatarFrame?: string;
  banner?: string;
  cardColor?: string;
  badges?: string[];
  userId?: string;
  level?: number;
  showcase?: ProfileShowcase;
  sockets: Set<string>;
}

/** playerToken → presence entry with all active socketIds */
export const presence = new Map<string, PresenceEntry>();

/** socketId → current activity for that socket */
export const socketActivity = new Map<string, PresenceActivity>();

/** Priority: room > game > home. Pick the most specific activity across all sockets for a token. */
function bestActivity(sockets: Set<string>): PresenceActivity | undefined {
  let best: PresenceActivity | undefined;
  let bestRank = -1;
  for (const sid of sockets) {
    const a = socketActivity.get(sid);
    if (!a) continue;
    const rank = a.kind === 'room' ? 2 : a.kind === 'game' ? 1 : 0;
    if (rank > bestRank) { best = a; bestRank = rank; }
  }
  return best;
}

export function buildPresenceList() {
  return [...presence.entries()]
    .map(([playerToken, { nickname, avatarId, nameColor, avatarFrame, banner, cardColor, badges, userId, level, showcase, sockets }]) => ({
      playerToken,
      nickname,
      connections: sockets.size,
      activity: bestActivity(sockets),
      avatarId,
      nameColor,
      avatarFrame,
      cosmetics: buildCosmetics({ avatarId, nameColor, avatarFrame, banner, cardColor, badges }),
      userId,
      level,
      showcase,
    }))
    .sort((a, b) => a.nickname.localeCompare(b.nickname, undefined, { sensitivity: 'base' }));
}

export function broadcastPresence(io: GameServer) {
  io.emit('online_users', { users: buildPresenceList() });
}
