import type { GameEngine, ActionContext, StatusResult } from 'shared';
import type {
  NexusClashState,
  NexusClashAction,
  NcLane,
  NcLaneModifier,
  NcCardInstance,
  NcPendingPlay,
  NcResolveEvent,
  NcCardDef,
  NcAbility,
} from 'shared';
import {
  NC_CARD_MAP,
  NC_STARTER_CARDS,
  NC_LANE_MODIFIERS,
  NC_START_HAND,
  NC_START_MANA,
  NC_MAX_MANA,
  NC_MANA_PER_ROUND,
  NC_DRAW_PER_ROUND,
  NC_PUSH_PER_POWER,
  NC_BREAKTHROUGH_THRESHOLD,
  NC_BREAKTHROUGHS_TO_WIN,
  NC_MAX_ROUNDS,
  NC_TURN_TIME_MS,
  NC_BOT_TOKEN_PREFIX,
  isNcBotToken,
} from 'shared';
import type { NcBotDifficulty } from 'shared';

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickUniqueModifiers(count: number): NcLaneModifier[] {
  const pool = shuffle(NC_LANE_MODIFIERS);
  return pool.slice(0, count);
}

function getCardDef(cardId: string): NcCardDef {
  const def = NC_CARD_MAP[cardId];
  if (!def) throw new Error(`INVALID_CARD: Unknown card id ${cardId}`);
  return def;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function deepCloneLanes(lanes: [NcLane, NcLane, NcLane]): [NcLane, NcLane, NcLane] {
  return lanes.map(l => ({
    ...l,
    cards: [
      l.cards[0].map(c => ({ ...c })),
      l.cards[1].map(c => ({ ...c })),
    ] as [NcCardInstance[], NcCardInstance[]],
  })) as [NcLane, NcLane, NcLane];
}

// ── Mana cost with lane modifier ─────────────────────────────────────────────

function effectiveManaCost(cardDef: NcCardDef, laneModifier: NcLaneModifier): number {
  let cost = cardDef.cost;
  if (laneModifier === 'cost_reduction') cost -= 1;
  if (laneModifier === 'mana_drain') cost += 1;
  return Math.max(0, cost);
}

// ── Compute spent mana from pending plays ────────────────────────────────────

function computeSpentMana(pendingPlays: NcPendingPlay[], lanes: [NcLane, NcLane, NcLane]): number {
  let spent = 0;
  for (const pp of pendingPlays) {
    const def = getCardDef(pp.cardId);
    spent += effectiveManaCost(def, lanes[pp.laneIndex].modifier);
  }
  return spent;
}

// ── Draw cards helper ────────────────────────────────────────────────────────

function drawCards(deck: string[], hand: string[], count: number, discardPile: string[]): { deck: string[]; hand: string[]; discardPile: string[] } {
  const newDeck = [...deck];
  const newHand = [...hand];
  const newDiscard = [...discardPile];
  for (let i = 0; i < count; i++) {
    // If deck is empty, reshuffle discard pile into deck
    if (newDeck.length === 0 && newDiscard.length > 0) {
      const reshuffled = shuffle(newDiscard);
      newDeck.push(...reshuffled);
      newDiscard.length = 0;
    }
    if (newDeck.length === 0) break;
    newHand.push(newDeck.shift()!);
  }
  return { deck: newDeck, hand: newHand, discardPile: newDiscard };
}

// ── Find all cards on all lanes for a player ─────────────────────────────────

function allCardsOnField(lanes: [NcLane, NcLane, NcLane], owner: 0 | 1): NcCardInstance[] {
  const result: NcCardInstance[] = [];
  for (const lane of lanes) {
    result.push(...lane.cards[owner]);
  }
  return result;
}

function findCardLane(lanes: [NcLane, NcLane, NcLane], uid: number): number {
  for (let i = 0; i < 3; i++) {
    for (const side of [0, 1] as const) {
      if (lanes[i].cards[side].some(c => c.uid === uid)) return i;
    }
  }
  return -1;
}

function removeCardFromLane(lane: NcLane, uid: number, owner: 0 | 1): NcCardInstance | null {
  const idx = lane.cards[owner].findIndex(c => c.uid === uid);
  if (idx === -1) return null;
  return lane.cards[owner].splice(idx, 1)[0];
}

// ── Resolution helpers ───────────────────────────────────────────────────────

function resolveRound(state: NexusClashState): NexusClashState {
  const s = {
    ...state,
    lanes: deepCloneLanes(state.lanes),
    pendingPlays: [[...state.pendingPlays[0]], [...state.pendingPlays[1]]] as [NcPendingPlay[], NcPendingPlay[]],
    breakthroughs: [state.breakthroughs[0], state.breakthroughs[1]] as [number, number],
    hands: [[...state.hands[0]], [...state.hands[1]]] as [string[], string[]],
    decks: [[...state.decks[0]], [...state.decks[1]]] as [string[], string[]],
    discardPiles: [[...state.discardPiles[0]], [...state.discardPiles[1]]] as [string[], string[]],
    mana: [state.mana[0], state.mana[1]] as [number, number],
    maxMana: [state.maxMana[0], state.maxMana[1]] as [number, number],
    manaBoost: [state.manaBoost[0], state.manaBoost[1]] as [number, number],
    history: [...state.history],
  };

  const log: NcResolveEvent[] = [];

  // Save history snapshot
  s.history.push({
    round: s.round,
    lanes: deepCloneLanes(s.lanes),
    mana: [s.mana[0], s.mana[1]],
    plays: [
      s.pendingPlays[0].map(p => ({ ...p })),
      s.pendingPlays[1].map(p => ({ ...p })),
    ],
  });

  // ── 1. Place pending cards on lanes ──────────────────────────────────────

  const newCardUids: Set<number> = new Set();
  const cardInfoMap: Map<number, { cardDef: NcCardDef; owner: 0 | 1; laneIndex: number }> = new Map();

  for (const pIdx of [0, 1] as const) {
    for (const pp of s.pendingPlays[pIdx]) {
      const def = getCardDef(pp.cardId);
      const instance: NcCardInstance = {
        uid: pp.cardUid,
        cardId: pp.cardId,
        power: def.power,
        basePower: def.power,
        owner: pIdx,
        shieldRounds: 0,
        playedThisRound: true,
      };
      s.lanes[pp.laneIndex].cards[pIdx].push(instance);
      newCardUids.add(pp.cardUid);
      cardInfoMap.set(pp.cardUid, { cardDef: def, owner: pIdx, laneIndex: pp.laneIndex });
      // Add played card to discard pile for reshuffle cycling
      s.discardPiles[pIdx].push(pp.cardId);

      log.push({
        type: 'card_revealed',
        laneIndex: pp.laneIndex,
        cardUid: pp.cardUid,
        owner: pIdx,
        cardId: pp.cardId,
      });
    }
  }

  // ── 2. Apply lane modifiers ─────────────────────────────────────────────

  for (let li = 0; li < 3; li++) {
    const lane = s.lanes[li];
    if (lane.locked) continue;
    const mod = lane.modifier;

    for (const side of [0, 1] as const) {
      for (const card of lane.cards[side]) {
        if (!card.playedThisRound) continue;

        if (mod === 'power_surge') {
          card.power += 1;
          card.basePower += 1;
        }

        const def = getCardDef(card.cardId);
        if (mod === 'tag_bonus_divine' && def.tags.includes('divine')) {
          card.power += 2;
          card.basePower += 2;
        }
        if (mod === 'tag_bonus_mech' && def.tags.includes('mech')) {
          card.power += 2;
          card.basePower += 2;
        }
        if (mod === 'tag_bonus_beast' && def.tags.includes('beast')) {
          card.power += 2;
          card.basePower += 2;
        }
      }
    }
  }

  // ── 3. On-Reveal effects ────────────────────────────────────────────────

  // Collect all new cards, sort by mana cost asc, ties by owner (p0 first)
  const revealCards: Array<{ uid: number; def: NcCardDef; owner: 0 | 1; laneIndex: number }> = [];
  for (const [uid, info] of cardInfoMap.entries()) {
    revealCards.push({ uid, def: info.cardDef, owner: info.owner, laneIndex: info.laneIndex });
  }
  revealCards.sort((a, b) => {
    if (a.def.cost !== b.def.cost) return a.def.cost - b.def.cost;
    return a.owner - b.owner;
  });

  // Track per-lane push bonuses from on_reveal effects
  const pushBonuses: [number, number][] = [[0, 0], [0, 0], [0, 0]];

  for (const rc of revealCards) {
    const ability = rc.def.ability;
    if (ability.trigger !== 'on_reveal') continue;

    // Find the card instance (it may have been moved/destroyed already)
    let cardLane = findCardLane(s.lanes, rc.uid);
    if (cardLane === -1) continue;
    const card = s.lanes[cardLane].cards[rc.owner].find(c => c.uid === rc.uid);
    if (!card) continue;

    log.push({
      type: 'ability_triggered',
      cardUid: rc.uid,
      trigger: 'on_reveal',
      effect: ability.effect,
      value: ability.value,
    });

    applyEffect(ability, card, rc.owner, cardLane, s.lanes, log, pushBonuses, newCardUids);
  }

  // ── 3b. Handle draw_card and mana_boost effects from newly placed cards ──
  for (const rc of revealCards) {
    const ability = rc.def.ability;
    if (ability.trigger !== 'on_reveal') continue;

    if (ability.effect === 'draw_card' && ability.value) {
      const drawn = drawCards(s.decks[rc.owner], s.hands[rc.owner], ability.value, s.discardPiles[rc.owner]);
      s.decks[rc.owner] = drawn.deck;
      s.hands[rc.owner] = drawn.hand;
      s.discardPiles[rc.owner] = drawn.discardPile;
    }

    if (ability.effect === 'mana_boost' && ability.value) {
      s.manaBoost[rc.owner] += ability.value;
    }
  }

  // ── 4. On-Ally-Played triggers ──────────────────────────────────────────

  for (let li = 0; li < 3; li++) {
    const lane = s.lanes[li];
    if (lane.locked) continue;

    for (const side of [0, 1] as const) {
      // Check if any new allied card was placed in this lane
      const hasNewAlly = lane.cards[side].some(c => newCardUids.has(c.uid));
      if (!hasNewAlly) continue;

      for (const card of lane.cards[side]) {
        if (newCardUids.has(card.uid)) continue; // only old cards trigger
        const def = getCardDef(card.cardId);
        if (def.ability.trigger !== 'on_ally_played') continue;

        log.push({
          type: 'ability_triggered',
          cardUid: card.uid,
          trigger: 'on_ally_played',
          effect: def.ability.effect,
          value: def.ability.value,
        });

        if (def.ability.effect === 'buff_self' && def.ability.value) {
          card.power += def.ability.value;
        }
      }
    }
  }

  // ── 5. Recalculate Ongoing effects ──────────────────────────────────────

  // Reset all card powers to base
  for (const lane of s.lanes) {
    for (const side of [0, 1] as const) {
      for (const card of lane.cards[side]) {
        card.power = card.basePower;
      }
    }
  }

  // Apply all ongoing abilities
  const doublePushFlags: Map<number, { owner: 0 | 1; conditionTag: string; conditionCount: number }> = new Map();

  for (let li = 0; li < 3; li++) {
    const lane = s.lanes[li];
    if (lane.locked) continue;

    for (const side of [0, 1] as const) {
      for (const card of lane.cards[side]) {
        const def = getCardDef(card.cardId);
        if (def.ability.trigger !== 'ongoing') continue;

        switch (def.ability.effect) {
          case 'power_per_tag': {
            const tag = def.ability.tagFilter;
            if (!tag) break;
            const allCards = allCardsOnField(s.lanes, side);
            const count = allCards.filter(c => {
              const d = getCardDef(c.cardId);
              return d.tags.includes(tag) && c.uid !== card.uid;
            }).length;
            card.power += (def.ability.value ?? 0) * count;
            break;
          }
          case 'double_push_if': {
            if (def.ability.conditionTag && def.ability.conditionCount) {
              doublePushFlags.set(card.uid, {
                owner: side,
                conditionTag: def.ability.conditionTag,
                conditionCount: def.ability.conditionCount,
              });
            }
            break;
          }
          case 'push_bonus': {
            pushBonuses[li][side] += (def.ability.value ?? 0);
            break;
          }
        }
      }
    }
  }

  // ── 6. Push calculation per lane ────────────────────────────────────────

  for (let li = 0; li < 3; li++) {
    const lane = s.lanes[li];
    if (lane.locked) continue;

    let p0Push = 0;
    let p1Push = 0;

    // Sum power of NEW cards only
    const p0NewCards = lane.cards[0].filter(c => c.playedThisRound);
    const p1NewCards = lane.cards[1].filter(c => c.playedThisRound);

    // double_first modifier: first card played has double push
    if (lane.modifier === 'double_first') {
      for (let i = 0; i < p0NewCards.length; i++) {
        p0Push += i === 0 ? p0NewCards[i].power * 2 : p0NewCards[i].power;
      }
      for (let i = 0; i < p1NewCards.length; i++) {
        p1Push += i === 0 ? p1NewCards[i].power * 2 : p1NewCards[i].power;
      }
    } else {
      for (const c of p0NewCards) p0Push += c.power;
      for (const c of p1NewCards) p1Push += c.power;
    }

    // Apply push bonuses from this round
    p0Push += pushBonuses[li][0];
    p1Push += pushBonuses[li][1];

    // Check double_push_if conditions
    for (const [uid, cond] of doublePushFlags.entries()) {
      const cardLaneIdx = findCardLane(s.lanes, uid);
      if (cardLaneIdx !== li) continue;
      const tagCount = lane.cards[cond.owner].filter(c => {
        const d = getCardDef(c.cardId);
        return d.tags.includes(cond.conditionTag as any);
      }).length;
      if (tagCount >= cond.conditionCount) {
        if (cond.owner === 0) p0Push *= 2;
        else p1Push *= 2;
      }
    }

    // inverted_power: lower total wins
    let delta: number;
    if (lane.modifier === 'inverted_power') {
      delta = (p1Push - p0Push) * NC_PUSH_PER_POWER; // inverted: p1 advantage moves toward positive (p0 side)
      // Actually inverted means lower total wins, so the smaller push value wins
      // Re-interpret: the player with LESS push gets the advantage
      const rawDelta = (p0Push - p1Push) * NC_PUSH_PER_POWER;
      delta = -rawDelta; // invert the outcome
    } else {
      delta = (p0Push - p1Push) * NC_PUSH_PER_POWER;
    }

    log.push({
      type: 'push_calculated',
      laneIndex: li,
      p0Push,
      p1Push,
      delta,
    });

    lane.tugValue = clamp(lane.tugValue + delta, -100, 100);

    // ── 7. Breakthrough check ───────────────────────────────────────────

    if (Math.abs(lane.tugValue) >= NC_BREAKTHROUGH_THRESHOLD && !lane.locked) {
      const winner: 0 | 1 = lane.tugValue > 0 ? 0 : 1;
      lane.locked = true;
      lane.breakthroughWinner = winner;
      s.breakthroughs[winner]++;

      log.push({
        type: 'breakthrough',
        laneIndex: li,
        winner,
      });
    }
  }

  // ── 8. Victory check ─────────────────────────────────────────────────

  let status: 'ongoing' | 'win' | 'draw' = 'ongoing';
  let winner: string | undefined;

  if (s.breakthroughs[0] >= NC_BREAKTHROUGHS_TO_WIN) {
    status = 'win';
    winner = s.playerIds[0];
  } else if (s.breakthroughs[1] >= NC_BREAKTHROUGHS_TO_WIN) {
    status = 'win';
    winner = s.playerIds[1];
  }

  // ── 9. Cleanup ───────────────────────────────────────────────────────

  // Reset playedThisRound
  for (const lane of s.lanes) {
    for (const side of [0, 1] as const) {
      for (const card of lane.cards[side]) {
        card.playedThisRound = false;
      }
    }
  }

  // Decrement shields
  for (const lane of s.lanes) {
    for (const side of [0, 1] as const) {
      for (const card of lane.cards[side]) {
        if (card.shieldRounds > 0) card.shieldRounds--;
      }
    }
  }

  // Clear pending plays and confirmed
  s.pendingPlays = [[], []];
  s.confirmed = [false, false];

  // ── 10. After round 7: final scoring ─────────────────────────────────

  if (status === 'ongoing' && s.round >= NC_MAX_ROUNDS) {
    // Determine winner by breakthroughs
    if (s.breakthroughs[0] > s.breakthroughs[1]) {
      status = 'win';
      winner = s.playerIds[0];
    } else if (s.breakthroughs[1] > s.breakthroughs[0]) {
      status = 'win';
      winner = s.playerIds[1];
    } else {
      // Tie in breakthroughs: compare total tug advantage
      let totalTug = 0;
      for (const lane of s.lanes) {
        totalTug += lane.tugValue;
      }
      if (totalTug > 0) {
        status = 'win';
        winner = s.playerIds[0];
      } else if (totalTug < 0) {
        status = 'win';
        winner = s.playerIds[1];
      } else {
        status = 'draw';
      }
    }
  }

  if (status !== 'ongoing') {
    s.phase = 'finished';
    s.status = status;
    s.winner = winner;
    s.resolveLog = log;
    s.turnDeadline = undefined;
    return s;
  }

  // Advance round
  s.round++;

  // Increase mana
  s.maxMana = [
    Math.min(NC_MAX_MANA, s.maxMana[0] + NC_MANA_PER_ROUND),
    Math.min(NC_MAX_MANA, s.maxMana[1] + NC_MANA_PER_ROUND),
  ];
  s.mana = [
    Math.min(NC_MAX_MANA, s.maxMana[0] + s.manaBoost[0]),
    Math.min(NC_MAX_MANA, s.maxMana[1] + s.manaBoost[1]),
  ];
  s.manaBoost = [0, 0]; // reset after applying

  // Draw cards (reshuffle discard pile into deck if empty)
  for (const pIdx of [0, 1] as const) {
    const drawn = drawCards(s.decks[pIdx], s.hands[pIdx], NC_DRAW_PER_ROUND, s.discardPiles[pIdx]);
    s.decks[pIdx] = drawn.deck;
    s.hands[pIdx] = drawn.hand;
    s.discardPiles[pIdx] = drawn.discardPile;
  }

  s.resolveLog = log;
  s.turnDeadline = Date.now() + NC_TURN_TIME_MS;

  return s;
}

// ── Apply a single effect ────────────────────────────────────────────────────

function applyEffect(
  ability: NcAbility,
  card: NcCardInstance,
  owner: 0 | 1,
  cardLane: number,
  lanes: [NcLane, NcLane, NcLane],
  log: NcResolveEvent[],
  pushBonuses: [number, number][],
  newCardUids: Set<number>,
): void {
  const lane = lanes[cardLane];
  const oppSide: 0 | 1 = owner === 0 ? 1 : 0;

  switch (ability.effect) {
    case 'buff_allies': {
      const val = ability.value ?? 0;
      for (const ally of lane.cards[owner]) {
        if (ally.uid === card.uid) continue;
        if (ability.tagFilter) {
          const d = getCardDef(ally.cardId);
          if (!d.tags.includes(ability.tagFilter)) continue;
        }
        ally.power += val;
        ally.basePower += val;
      }
      break;
    }

    case 'buff_self': {
      const val = ability.value ?? 0;
      card.power += val;
      card.basePower += val;
      break;
    }

    case 'debuff_enemies': {
      const val = ability.value ?? 0;
      for (const enemy of lane.cards[oppSide]) {
        enemy.power = Math.max(0, enemy.power - val);
        enemy.basePower = Math.max(0, enemy.basePower - val);
      }
      break;
    }

    case 'push_bonus': {
      pushBonuses[cardLane][owner] += (ability.value ?? 0);
      break;
    }

    case 'move_to_lane': {
      let targetLane = -1;
      if (ability.laneTarget === 'strongest' || ability.laneTarget === 'weakest') {
        // Find lane with highest/lowest tug from this player's perspective
        let best = -1;
        let bestVal = ability.laneTarget === 'strongest' ? -Infinity : Infinity;
        for (let i = 0; i < 3; i++) {
          if (i === cardLane || lanes[i].locked) continue;
          const v = owner === 0 ? lanes[i].tugValue : -lanes[i].tugValue;
          if (ability.laneTarget === 'strongest' && v > bestVal) {
            bestVal = v;
            best = i;
          }
          if (ability.laneTarget === 'weakest' && v < bestVal) {
            bestVal = v;
            best = i;
          }
        }
        targetLane = best;
      } else {
        // random
        const candidates = [0, 1, 2].filter(i => i !== cardLane && !lanes[i].locked);
        if (candidates.length > 0) {
          targetLane = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }

      if (targetLane >= 0 && targetLane !== cardLane) {
        const removed = removeCardFromLane(lane, card.uid, owner);
        if (removed) {
          lanes[targetLane].cards[owner].push(removed);
          log.push({
            type: 'card_moved',
            cardUid: card.uid,
            fromLane: cardLane,
            toLane: targetLane,
          });
        }
      }
      break;
    }

    case 'destroy_weakest_enemy': {
      const enemies = lane.cards[oppSide].filter(c => {
        // Respect shields
        if (c.shieldRounds > 0) return false;
        // Respect indestructible modifier
        if (lane.modifier === 'indestructible') return false;
        return true;
      });
      if (enemies.length === 0) break;
      enemies.sort((a, b) => a.power - b.power);
      const weakest = enemies[0];
      const idx = lane.cards[oppSide].findIndex(c => c.uid === weakest.uid);
      if (idx !== -1) {
        const destroyed = lane.cards[oppSide].splice(idx, 1)[0];
        log.push({
          type: 'card_destroyed',
          laneIndex: cardLane,
          cardUid: destroyed.uid,
          owner: oppSide,
        });

        // Trigger on_destroy effect
        const destroyedDef = getCardDef(destroyed.cardId);
        if (destroyedDef.ability.trigger === 'on_destroy') {
          log.push({
            type: 'ability_triggered',
            cardUid: destroyed.uid,
            trigger: 'on_destroy',
            effect: destroyedDef.ability.effect,
            value: destroyedDef.ability.value,
          });
          // Phoenix special: on_destroy with buff_self value -1 means respawn with reduced power
          // Respawn the card with power 3 (phoenix special case)
          if (destroyedDef.ability.effect === 'buff_self' && destroyedDef.ability.value === -1) {
            const respawned: NcCardInstance = {
              ...destroyed,
              power: 3,
              basePower: 3,
              playedThisRound: true,
            };
            lane.cards[oppSide].push(respawned);
          }
        }
      }
      break;
    }

    case 'copy_strongest_ally_power': {
      const allies = lane.cards[owner].filter(c => c.uid !== card.uid);
      if (allies.length === 0) break;
      const maxPower = Math.max(...allies.map(a => a.power));
      card.power = maxPower;
      card.basePower = maxPower;
      break;
    }

    case 'shield': {
      card.shieldRounds = ability.value ?? 1;
      break;
    }

    case 'drain': {
      const val = ability.value ?? 0;
      const enemies = lane.cards[oppSide];
      if (enemies.length === 0) break;
      // Find strongest enemy
      let strongest = enemies[0];
      for (const e of enemies) {
        if (e.power > strongest.power) strongest = e;
      }
      const drained = Math.min(val, strongest.power);
      strongest.power -= drained;
      strongest.basePower -= drained;
      card.power += drained;
      card.basePower += drained;
      break;
    }

    case 'swap_lane_positions': {
      // Swap tugValues of two random OTHER lanes
      const otherLanes = [0, 1, 2].filter(i => i !== cardLane && !lanes[i].locked);
      if (otherLanes.length >= 2) {
        const shuffled = shuffle(otherLanes);
        const a = shuffled[0];
        const b = shuffled[1];
        const tmp = lanes[a].tugValue;
        lanes[a].tugValue = lanes[b].tugValue;
        lanes[b].tugValue = tmp;
      }
      break;
    }

    case 'draw_card': {
      // draw_card is handled at resolve level, not in applyEffect per-lane
      // Just log it; actual draw happens in resolveRound after effects
      break;
    }

    case 'mana_boost': {
      // Tracked at state level, applied at start of next round
      break;
    }

    case 'heal_allies': {
      const val = ability.value ?? 0;
      for (const ally of lane.cards[owner]) {
        if (ally.uid === card.uid) continue;
        ally.power += val;
        ally.basePower += val;
      }
      break;
    }

    case 'destroy_strongest_enemy': {
      const enemies = lane.cards[oppSide].filter(c => {
        if (c.shieldRounds > 0) return false;
        if (lane.modifier === 'indestructible') return false;
        return true;
      });
      if (enemies.length === 0) break;
      enemies.sort((a, b) => b.power - a.power);
      const strongest = enemies[0];
      const idx = lane.cards[oppSide].findIndex(c => c.uid === strongest.uid);
      if (idx !== -1) {
        const destroyed = lane.cards[oppSide].splice(idx, 1)[0];
        log.push({
          type: 'card_destroyed',
          laneIndex: cardLane,
          cardUid: destroyed.uid,
          owner: oppSide,
        });
        const destroyedDef = getCardDef(destroyed.cardId);
        if (destroyedDef.ability.trigger === 'on_destroy') {
          log.push({
            type: 'ability_triggered',
            cardUid: destroyed.uid,
            trigger: 'on_destroy',
            effect: destroyedDef.ability.effect,
            value: destroyedDef.ability.value,
          });
          if (destroyedDef.ability.effect === 'buff_self' && destroyedDef.ability.value === -1) {
            const respawned: NcCardInstance = {
              ...destroyed,
              power: 3,
              basePower: 3,
              playedThisRound: true,
            };
            lane.cards[oppSide].push(respawned);
          }
        }
      }
      break;
    }

    case 'double_push_if':
    case 'power_per_tag':
      // These are ongoing effects, not on_reveal
      break;
  }
}

// ── Bot AI ────────────────────────────────────────────────────────────────────

function computeBotPlays(
  state: NexusClashState,
  botIdx: 0 | 1,
  difficulty: NcBotDifficulty,
): Array<{ cardId: string; laneIndex: 0 | 1 | 2 }> {
  const hand = state.hands[botIdx];
  if (hand.length === 0) return [];

  const plays: Array<{ cardId: string; laneIndex: 0 | 1 | 2 }> = [];
  let remainingMana = state.mana[botIdx] - computeSpentMana(state.pendingPlays[botIdx], state.lanes as [NcLane, NcLane, NcLane]);
  const availableCards = [...hand];

  // Sort cards by cost descending (play expensive cards first)
  const sortedCards = availableCards
    .map(id => ({ id, def: getCardDef(id) }))
    .filter(c => c.def.cost <= remainingMana)
    .sort((a, b) => b.def.cost - a.def.cost);

  for (const card of sortedCards) {
    if (remainingMana < card.def.cost) continue;

    // Pick target lane
    let targetLane: 0 | 1 | 2;

    if (difficulty === 'easy') {
      // Random lane
      const unlocked = ([0, 1, 2] as const).filter(i => !state.lanes[i].locked);
      if (unlocked.length === 0) break;
      targetLane = unlocked[Math.floor(Math.random() * unlocked.length)];
    } else if (difficulty === 'medium') {
      // Play to weakest lane (where bot is losing most)
      const unlocked = ([0, 1, 2] as const).filter(i => !state.lanes[i].locked);
      if (unlocked.length === 0) break;
      const perspective = botIdx === 0 ? 1 : -1;
      unlocked.sort((a, b) => (state.lanes[a].tugValue * perspective) - (state.lanes[b].tugValue * perspective));
      targetLane = unlocked[0];
    } else {
      // Hard: play to lane closest to breakthrough for bot, or defend weakest
      const unlocked = ([0, 1, 2] as const).filter(i => !state.lanes[i].locked);
      if (unlocked.length === 0) break;
      const perspective = botIdx === 0 ? 1 : -1;
      // Prioritize lanes close to winning (positive tug for bot)
      const laneScores = unlocked.map(i => {
        const tug = state.lanes[i].tugValue * perspective;
        // High score = good for bot (close to breakthrough)
        if (tug > 60) return { lane: i, score: 100 + tug }; // almost winning, push to finish
        if (tug < -60) return { lane: i, score: 90 - tug }; // almost losing, defend
        return { lane: i, score: 50 + tug }; // neutral
      });
      laneScores.sort((a, b) => b.score - a.score);
      targetLane = laneScores[0].lane;
    }

    // Check effective mana cost with lane modifier
    const effectiveCost = effectiveManaCost(card.def, state.lanes[targetLane].modifier);
    if (effectiveCost > remainingMana) continue;

    plays.push({ cardId: card.id, laneIndex: targetLane });
    remainingMana -= effectiveCost;

    // Easy bot: only plays 1 card per round
    if (difficulty === 'easy' && plays.length >= 1) break;
    // Medium: plays up to 2
    if (difficulty === 'medium' && plays.length >= 2) break;
    // Hard: plays as many as possible (no break)
  }

  return plays;
}

// ── Engine ────────────────────────────────────────────────────────────────────

export const nexusClashEngine: GameEngine<NexusClashState, NexusClashAction> = {
  simultaneousInput: true,
  tickInterval: 1000,

  initialState(playerIds: string[], _startingPlayerIndex?: number, config?: unknown): NexusClashState {
    const p0 = playerIds[0];
    const p1 = playerIds[1];
    const gameConfig = config as { botDifficulty?: NcBotDifficulty } | undefined;

    // Pick 3 unique lane modifiers
    const modifiers = pickUniqueModifiers(3);

    // Build lanes
    const lanes: [NcLane, NcLane, NcLane] = [0, 1, 2].map((_, i) => ({
      tugValue: 0,
      cards: [[], []] as [NcCardInstance[], NcCardInstance[]],
      modifier: modifiers[i],
      locked: false,
      breakthroughWinner: null,
    })) as [NcLane, NcLane, NcLane];

    // Build decks: 12 unique cards (1 copy each)
    const buildDeck = (): string[] => {
      return shuffle([...NC_STARTER_CARDS]);
    };

    const deck0 = buildDeck();
    const deck1 = buildDeck();

    // Draw initial hands (with reshuffle support)
    const discard0: string[] = [];
    const discard1: string[] = [];
    const draw0 = drawCards(deck0, [], NC_START_HAND, discard0);
    const draw1 = drawCards(deck1, [], NC_START_HAND, discard1);

    return {
      playerIds: [p0, p1],
      round: 1,
      maxRounds: NC_MAX_ROUNDS,
      phase: 'mulligan' as const,
      lanes,
      hands: [draw0.hand, draw1.hand],
      decks: [draw0.deck, draw1.deck],
      discardPiles: [draw0.discardPile, draw1.discardPile],
      mana: [NC_START_MANA, NC_START_MANA],
      maxMana: [NC_START_MANA, NC_START_MANA],
      manaBoost: [0, 0] as [number, number],
      pendingPlays: [[], []],
      confirmed: [false, false],
      breakthroughs: [0, 0],
      nextUid: 1,
      resolveLog: [],
      status: 'ongoing',
      currentTurn: p0, // Required by server sanity guard
      turnDeadline: Date.now() + NC_TURN_TIME_MS,
      history: [],
      mulliganDecisions: [null, null] as [('keep' | 'redraw' | null), ('keep' | 'redraw' | null)],
      botDifficulty: gameConfig?.botDifficulty,
    };
  },

  applyAction(state: NexusClashState, action: NexusClashAction, ctx: ActionContext): NexusClashState {
    if (state.status !== 'ongoing') throw new Error('GAME_OVER: Game is already finished');

    const pIdx = state.playerIds.indexOf(ctx.playerId);
    if (pIdx === -1 || (pIdx !== 0 && pIdx !== 1)) throw new Error('NOT_IN_ROOM: You are not a player');
    const pi = pIdx as 0 | 1;

    // ── Mulligan Phase ──
    if (state.phase === 'mulligan') {
      if (action.type !== 'nc_mulligan') throw new Error('INVALID_ACTION: Must mulligan first');

      const decisions = [state.mulliganDecisions[0], state.mulliganDecisions[1]] as [('keep' | 'redraw' | null), ('keep' | 'redraw' | null)];
      decisions[pi] = action.decision;

      // If both decided, process mulligans and move to placing
      if (decisions[0] !== null && decisions[1] !== null) {
        const newHands = [[...state.hands[0]], [...state.hands[1]]] as [string[], string[]];
        const newDecks = [[...state.decks[0]], [...state.decks[1]]] as [string[], string[]];
        const newDiscards = [[...state.discardPiles[0]], [...state.discardPiles[1]]] as [string[], string[]];

        for (const idx of [0, 1] as const) {
          if (decisions[idx] === 'redraw') {
            // Put hand back in deck and reshuffle
            newDecks[idx].push(...newHands[idx]);
            newDecks[idx] = shuffle(newDecks[idx]);
            newHands[idx] = [];
            // Draw new hand
            const drawn = drawCards(newDecks[idx], newHands[idx], NC_START_HAND, newDiscards[idx]);
            newDecks[idx] = drawn.deck;
            newHands[idx] = drawn.hand;
            newDiscards[idx] = drawn.discardPile;
          }
        }

        return {
          ...state,
          phase: 'placing' as any,
          mulliganDecisions: decisions,
          hands: newHands,
          decks: newDecks,
          discardPiles: newDiscards,
          turnDeadline: Date.now() + NC_TURN_TIME_MS,
        };
      }

      return {
        ...state,
        mulliganDecisions: decisions,
      };
    }

    if (state.phase !== 'placing') throw new Error('INVALID_PHASE: Can only act during placing phase');

    switch (action.type) {
      case 'nc_place': {
        if (state.confirmed[pi]) throw new Error('ALREADY_CONFIRMED: Cannot place after confirming');

        const { cardId, laneIndex } = action;
        if (laneIndex < 0 || laneIndex > 2) throw new Error('INVALID_LANE: Lane index must be 0-2');

        // Check lane is not locked
        if (state.lanes[laneIndex].locked) throw new Error('LANE_LOCKED: Cannot play on a locked lane');

        // Verify card is in hand
        const handIdx = state.hands[pi].indexOf(cardId);
        if (handIdx === -1) throw new Error('CARD_NOT_IN_HAND: Card not found in your hand');

        const def = getCardDef(cardId);
        const cost = effectiveManaCost(def, state.lanes[laneIndex].modifier);

        // Calculate remaining mana after existing pending plays
        const spentMana = computeSpentMana(state.pendingPlays[pi], state.lanes as [NcLane, NcLane, NcLane]);
        const remainingMana = state.mana[pi] - spentMana;

        if (cost > remainingMana) throw new Error('NOT_ENOUGH_MANA: Insufficient mana');

        // Remove card from hand
        const newHands = [
          [...state.hands[0]],
          [...state.hands[1]],
        ] as [string[], string[]];
        newHands[pi].splice(handIdx, 1);

        // Create pending play with unique uid
        const uid = state.nextUid;
        const newPending = [
          [...state.pendingPlays[0]],
          [...state.pendingPlays[1]],
        ] as [NcPendingPlay[], NcPendingPlay[]];
        newPending[pi].push({ cardUid: uid, cardId, laneIndex });

        return {
          ...state,
          hands: newHands,
          pendingPlays: newPending,
          nextUid: uid + 1,
        };
      }

      case 'nc_undo': {
        if (state.confirmed[pi]) throw new Error('ALREADY_CONFIRMED: Cannot undo after confirming');

        const { cardUid } = action;
        const ppIdx = state.pendingPlays[pi].findIndex(p => p.cardUid === cardUid);
        if (ppIdx === -1) throw new Error('NOT_FOUND: Pending play not found');

        const pp = state.pendingPlays[pi][ppIdx];

        // Return card to hand
        const newHands = [
          [...state.hands[0]],
          [...state.hands[1]],
        ] as [string[], string[]];
        newHands[pi].push(pp.cardId);

        // Remove pending play
        const newPending = [
          [...state.pendingPlays[0]],
          [...state.pendingPlays[1]],
        ] as [NcPendingPlay[], NcPendingPlay[]];
        newPending[pi].splice(ppIdx, 1);

        return {
          ...state,
          hands: newHands,
          pendingPlays: newPending,
        };
      }

      case 'nc_confirm': {
        if (state.confirmed[pi]) throw new Error('ALREADY_CONFIRMED: Already confirmed');

        const newConfirmed = [state.confirmed[0], state.confirmed[1]] as [boolean, boolean];
        newConfirmed[pi] = true;

        // If both confirmed, resolve the round
        if (newConfirmed[0] && newConfirmed[1]) {
          return resolveRound({ ...state, confirmed: newConfirmed });
        }

        // Only one confirmed
        return {
          ...state,
          confirmed: newConfirmed,
        };
      }

      default:
        throw new Error('INVALID_ACTION: Unknown action type');
    }
  },

  getStatus(state: NexusClashState): StatusResult {
    return { status: state.status, winner: state.winner };
  },

  tick(state: NexusClashState): NexusClashState {
    if (state.status !== 'ongoing') return state;

    // ── Bot mulligan ──
    if (state.phase === 'mulligan') {
      for (const pIdx of [0, 1] as const) {
        if (isNcBotToken(state.playerIds[pIdx]) && state.mulliganDecisions[pIdx] === null) {
          const decisions = [...state.mulliganDecisions] as [('keep' | 'redraw' | null), ('keep' | 'redraw' | null)];
          decisions[pIdx] = 'keep';

          if (decisions[0] !== null && decisions[1] !== null) {
            // Process mulligans
            const newHands = [[...state.hands[0]], [...state.hands[1]]] as [string[], string[]];
            const newDecks = [[...state.decks[0]], [...state.decks[1]]] as [string[], string[]];
            const newDiscards = [[...state.discardPiles[0]], [...state.discardPiles[1]]] as [string[], string[]];

            for (const idx of [0, 1] as const) {
              if (decisions[idx] === 'redraw') {
                newDecks[idx].push(...newHands[idx]);
                newDecks[idx] = shuffle(newDecks[idx]);
                newHands[idx] = [];
                const drawn = drawCards(newDecks[idx], newHands[idx], NC_START_HAND, newDiscards[idx]);
                newDecks[idx] = drawn.deck;
                newHands[idx] = drawn.hand;
                newDiscards[idx] = drawn.discardPile;
              }
            }

            return {
              ...state,
              phase: 'placing' as any,
              mulliganDecisions: decisions,
              hands: newHands,
              decks: newDecks,
              discardPiles: newDiscards,
              turnDeadline: Date.now() + NC_TURN_TIME_MS,
            };
          }
          return { ...state, mulliganDecisions: decisions };
        }
      }
      return state;
    }

    if (state.phase !== 'placing') return state;

    // ── Bot play logic ──
    for (const pIdx of [0, 1] as const) {
      if (!isNcBotToken(state.playerIds[pIdx])) continue;
      if (state.confirmed[pIdx]) continue;

      // Bot places cards and confirms
      let s = { ...state, hands: [[...state.hands[0]], [...state.hands[1]]] as [string[], string[]], pendingPlays: [[...state.pendingPlays[0]], [...state.pendingPlays[1]]] as [NcPendingPlay[], NcPendingPlay[]] };

      const difficulty = state.botDifficulty ?? 'medium';
      const botPlays = computeBotPlays(s, pIdx, difficulty);

      for (const play of botPlays) {
        const def = getCardDef(play.cardId);
        const cost = effectiveManaCost(def, s.lanes[play.laneIndex].modifier);
        const spent = computeSpentMana(s.pendingPlays[pIdx], s.lanes as [NcLane, NcLane, NcLane]);
        if (cost > s.mana[pIdx] - spent) continue;
        if (s.lanes[play.laneIndex].locked) continue;

        const handIdx = s.hands[pIdx].indexOf(play.cardId);
        if (handIdx === -1) continue;

        s.hands[pIdx].splice(handIdx, 1);
        s.pendingPlays[pIdx].push({
          cardUid: s.nextUid,
          cardId: play.cardId,
          laneIndex: play.laneIndex,
        });
        s.nextUid = (s.nextUid ?? 1) + 1;
      }

      // Confirm
      const newConfirmed = [s.confirmed[0], s.confirmed[1]] as [boolean, boolean];
      newConfirmed[pIdx] = true;
      s.confirmed = newConfirmed;

      if (s.confirmed[0] && s.confirmed[1]) {
        return resolveRound(s);
      }
      return s;
    }

    // ── Timer auto-confirm ──
    if (!state.turnDeadline) return state;
    if (Date.now() < state.turnDeadline) return state;

    let newConfirmed = [state.confirmed[0], state.confirmed[1]] as [boolean, boolean];
    let changed = false;

    if (!newConfirmed[0]) { newConfirmed[0] = true; changed = true; }
    if (!newConfirmed[1]) { newConfirmed[1] = true; changed = true; }

    if (!changed) return state;

    if (newConfirmed[0] && newConfirmed[1]) {
      return resolveRound({ ...state, confirmed: newConfirmed });
    }

    return { ...state, confirmed: newConfirmed };
  },
};
