import type { GameId, PartyState, PartyMember, CosmeticsSelection } from 'shared';
import { randomUUID } from 'node:crypto';

const MAX_PARTY_SIZE = 6;

interface PartyInternal {
  id: string;
  hostToken: string;
  /** Ordered set of member tokens (host is always first). */
  members: string[];
  currentRoomCode?: string;
  currentGameId?: GameId;
  createdAt: number;
}

type NickResolver = (token: string) => { nickname: string; avatarId?: string; cosmetics?: CosmeticsSelection } | undefined;

export class PartyManager {
  /** partyId → Party */
  private parties = new Map<string, PartyInternal>();
  /** playerToken → partyId (each player can only be in one party) */
  private playerParty = new Map<string, string>();

  /** Create a new party. Returns the party or null if the player is already in one. */
  create(hostToken: string): PartyInternal | null {
    if (this.playerParty.has(hostToken)) return null;
    const party: PartyInternal = {
      id: randomUUID(),
      hostToken,
      members: [hostToken],
      createdAt: Date.now(),
    };
    this.parties.set(party.id, party);
    this.playerParty.set(hostToken, party.id);
    return party;
  }

  /** Add a member to a party. Returns the party or null on error. */
  join(partyId: string, token: string): PartyInternal | null {
    const party = this.parties.get(partyId);
    if (!party) return null;
    if (party.members.includes(token)) return party; // already in
    if (party.members.length >= MAX_PARTY_SIZE) return null;
    // Leave any existing party first
    this.leave(token);
    party.members.push(token);
    this.playerParty.set(token, partyId);
    return party;
  }

  /** Remove a member. If the host leaves, the party is disbanded. Returns disbanded=true if so. */
  leave(token: string): { party: PartyInternal | null; disbanded: boolean } {
    const partyId = this.playerParty.get(token);
    if (!partyId) return { party: null, disbanded: false };
    const party = this.parties.get(partyId);
    if (!party) {
      this.playerParty.delete(token);
      return { party: null, disbanded: false };
    }
    if (token === party.hostToken) {
      // Host leaves → disband entire party
      for (const m of party.members) this.playerParty.delete(m);
      this.parties.delete(partyId);
      return { party, disbanded: true };
    }
    party.members = party.members.filter((m) => m !== token);
    this.playerParty.delete(token);
    return { party, disbanded: false };
  }

  /** Kick a member (host only). */
  kick(hostToken: string, targetToken: string): PartyInternal | null {
    const partyId = this.playerParty.get(hostToken);
    if (!partyId) return null;
    const party = this.parties.get(partyId);
    if (!party || party.hostToken !== hostToken) return null;
    if (targetToken === hostToken) return null; // can't kick self
    if (!party.members.includes(targetToken)) return null;
    party.members = party.members.filter((m) => m !== targetToken);
    this.playerParty.delete(targetToken);
    return party;
  }

  /** Set the current room/game for the party. */
  setRoom(partyId: string, gameId: GameId, roomCode: string): void {
    const party = this.parties.get(partyId);
    if (party) {
      party.currentGameId = gameId;
      party.currentRoomCode = roomCode;
    }
  }

  /** Clear the room reference (e.g., when game ends and members leave). */
  clearRoom(partyId: string): void {
    const party = this.parties.get(partyId);
    if (party) {
      party.currentGameId = undefined;
      party.currentRoomCode = undefined;
    }
  }

  /** Get the party a player is in. */
  getByToken(token: string): PartyInternal | undefined {
    const partyId = this.playerParty.get(token);
    return partyId ? this.parties.get(partyId) : undefined;
  }

  /** Get party by ID. */
  getById(id: string): PartyInternal | undefined {
    return this.parties.get(id);
  }

  /** Build the client-facing PartyState with resolved nicknames. */
  toState(party: PartyInternal, resolve: NickResolver): PartyState {
    const members: PartyMember[] = party.members.map((token) => {
      const info = resolve(token);
      return {
        token,
        nickname: info?.nickname ?? 'Player',
        avatarId: info?.avatarId,
        cosmetics: info?.cosmetics,
      };
    });
    return {
      id: party.id,
      hostToken: party.hostToken,
      members,
      currentRoomCode: party.currentRoomCode,
      currentGameId: party.currentGameId,
    };
  }
}
