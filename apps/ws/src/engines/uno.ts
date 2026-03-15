import type { GameEngine, ActionContext, StatusResult, GameStatus } from 'shared';
import type { UnoState, UnoAction, UnoCard, UnoColor, UnoPlayer, UnoRuleConfig } from 'shared';
import { UNO_HAND_SIZE, UNO_PENALTY_CARDS, UNO_DEFAULT_RULES } from 'shared';

// ── Deck builder ────────────────────────────────────────────────────────────

const COLORS: UnoColor[] = ['red', 'yellow', 'green', 'blue'];

function buildDeck(): UnoCard[] {
  const cards: UnoCard[] = [];
  let id = 0;

  for (const color of COLORS) {
    // One 0 per color
    cards.push({ id: id++, type: 'number', color, value: 0 });
    // Two each of 1-9
    for (let v = 1; v <= 9; v++) {
      cards.push({ id: id++, type: 'number', color, value: v });
      cards.push({ id: id++, type: 'number', color, value: v });
    }
    // Two each of Skip, Reverse, Draw2
    for (let i = 0; i < 2; i++) {
      cards.push({ id: id++, type: 'skip', color, value: null });
      cards.push({ id: id++, type: 'reverse', color, value: null });
      cards.push({ id: id++, type: 'draw2', color, value: null });
    }
  }
  // 4 Wild + 4 Wild Draw 4
  for (let i = 0; i < 4; i++) {
    cards.push({ id: id++, type: 'wild', color: null, value: null });
    cards.push({ id: id++, type: 'wild4', color: null, value: null });
  }

  return cards;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Card playability ────────────────────────────────────────────────────────

function canPlayCard(card: UnoCard, topCard: UnoCard, chosenColor: UnoColor | null): boolean {
  // Wild and Wild4 can always be played
  if (card.type === 'wild' || card.type === 'wild4') return true;
  // Match by active color (chosenColor overrides topCard.color for wilds)
  const activeColor = chosenColor ?? topCard.color;
  if (card.color === activeColor) return true;
  // Match by value/type
  if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) return true;
  if (card.type !== 'number' && card.type === topCard.type) return true;
  return false;
}

function hasPlayableCard(hand: UnoCard[], topCard: UnoCard, chosenColor: UnoColor | null): boolean {
  return hand.some(c => canPlayCard(c, topCard, chosenColor));
}

/** Check if a card can be stacked on an active draw penalty. */
function canStackCard(card: UnoCard, source: 'draw2' | 'wild4', rules: Required<UnoRuleConfig>): boolean {
  if (source === 'draw2') {
    if (card.type === 'draw2' && rules.stackDraw2) return true;
    if (card.type === 'wild4' && rules.allowDraw4OnDraw2) return true;
    return false;
  }
  // source === 'wild4'
  if (card.type === 'wild4' && rules.stackDraw4) return true;
  if (card.type === 'draw2' && rules.allowDraw2OnDraw4) return true;
  return false;
}

function hasStackableCard(hand: UnoCard[], source: 'draw2' | 'wild4', rules: Required<UnoRuleConfig>): boolean {
  return hand.some(c => canStackCard(c, source, rules));
}

// ── Turn advancement ────────────────────────────────────────────────────────

function advanceTurn(state: UnoState, skip: number = 1): void {
  const n = state.playerIds.length;
  state.turnIndex = ((state.turnIndex + state.direction * skip) % n + n) % n;
  state.currentTurn = state.playerIds[state.turnIndex];
}

function drawCards(state: UnoState, playerIndex: number, count: number): void {
  for (let i = 0; i < count; i++) {
    if (state.drawPile.length === 0) {
      // Reshuffle discard into draw pile, keeping topCard
      if (state.discardPile.length <= 1) break; // no cards to reshuffle
      const top = state.discardPile.pop()!;
      state.drawPile = shuffle(state.discardPile);
      state.discardPile = [top];
    }
    const card = state.drawPile.pop()!;
    state.hands[playerIndex].push(card);
  }
  state.players[playerIndex].handCount = state.hands[playerIndex].length;
}

// ── Scoring ─────────────────────────────────────────────────────────────────

function cardPoints(card: UnoCard): number {
  if (card.type === 'number') return card.value ?? 0;
  if (card.type === 'skip' || card.type === 'reverse' || card.type === 'draw2') return 20;
  // wild / wild4
  return 50;
}

function scoreHands(hands: UnoCard[][], winnerIndex: number): number {
  let total = 0;
  for (let i = 0; i < hands.length; i++) {
    if (i === winnerIndex) continue;
    for (const c of hands[i]) total += cardPoints(c);
  }
  return total;
}

// ── Engine ──────────────────────────────────────────────────────────────────

export const unoEngine: GameEngine<UnoState, UnoAction> = {
  initialState(playerIds: string[], startingPlayerIndex: number = 0, config?: unknown): UnoState {
    const cfg = (config ?? {}) as UnoRuleConfig;
    const rules: Required<UnoRuleConfig> = { ...UNO_DEFAULT_RULES, ...cfg };

    const players: UnoPlayer[] = playerIds.map(token => ({
      token,
      nickname: '',
      handCount: 0,
      calledUno: false,
      matchScore: 0,
    }));

    // Lobby state — game starts when host sends UNO_START
    return {
      phase: 'lobby',
      players,
      playerIds: [...playerIds],
      currentTurn: playerIds[0], // Required by server sanity guard
      turnIndex: startingPlayerIndex,
      direction: 1,
      hands: playerIds.map(() => []),
      drawPile: [],
      discardPile: [],
      topCard: { id: -1, type: 'number', color: 'red', value: 0 }, // placeholder
      chosenColor: null,
      pendingDraw: 0,
      status: 'ongoing',
      winner: null,
      lastAction: null,
      nextCardId: 0,
      mustDraw: false,
      matchTargetScore: rules.targetScore,
      roundNumber: 1,
      roundWinner: null,
      roundPoints: 0,
      rules,
      drawnCardId: null,
      pendingDrawSource: null,
    };
  },

  applyAction(state: UnoState, action: UnoAction, ctx: ActionContext): UnoState {
    const s = { ...state, players: state.players.map(p => ({ ...p })) };

    if (action.type === 'UNO_START') {
      if (s.phase !== 'lobby') throw new Error('INVALID_ACTION: Game already started');
      // Only host (index 0) can start
      if (ctx.playerIndex !== 0) throw new Error('INVALID_ACTION: Only host can start');
      if (s.playerIds.length < 2) throw new Error('INVALID_ACTION: Need at least 2 players');

      // Build and shuffle deck
      let deck = shuffle(buildDeck());
      let nextId = deck.length;

      // Assign stable IDs
      deck = deck.map((c, i) => ({ ...c, id: i }));
      nextId = deck.length;

      // Deal hands
      const hands: UnoCard[][] = s.playerIds.map(() => []);
      for (let i = 0; i < UNO_HAND_SIZE; i++) {
        for (let p = 0; p < s.playerIds.length; p++) {
          hands[p].push(deck.pop()!);
        }
      }

      // Flip first non-wild card for discard
      let topCard: UnoCard | undefined;
      const discardPile: UnoCard[] = [];
      while (deck.length > 0) {
        const c = deck.pop()!;
        if (c.type === 'wild' || c.type === 'wild4') {
          // Put wild back somewhere in the deck
          deck.unshift(c);
          continue;
        }
        topCard = c;
        discardPile.push(c);
        break;
      }
      if (!topCard) {
        // Extremely unlikely, but handle it
        topCard = deck.pop()!;
        discardPile.push(topCard);
      }

      // Apply starting card effects
      let turnIdx = s.turnIndex;
      let direction: 1 | -1 = 1;
      let pendingDraw = 0;
      const n = s.playerIds.length;

      if (topCard.type === 'skip') {
        turnIdx = ((turnIdx + direction) % n + n) % n;
      } else if (topCard.type === 'reverse') {
        direction = -1;
        if (n === 2) {
          // 2-player: reverse acts as skip
          turnIdx = ((turnIdx + direction) % n + n) % n;
        }
      } else if (topCard.type === 'draw2') {
        pendingDraw = 2;
      }

      const drawSrc = pendingDraw > 0 ? 'draw2' as const : null;
      s.phase = 'playing';
      s.hands = hands;
      s.drawPile = deck;
      s.discardPile = discardPile;
      s.topCard = topCard;
      s.chosenColor = null;
      s.turnIndex = turnIdx;
      s.direction = direction;
      s.pendingDraw = pendingDraw;
      s.pendingDrawSource = drawSrc;
      s.currentTurn = s.playerIds[turnIdx];
      s.nextCardId = nextId;
      s.drawnCardId = null;
      s.mustDraw = pendingDraw > 0
        ? !hasStackableCard(hands[turnIdx], drawSrc!, s.rules)
        : !hasPlayableCard(hands[turnIdx], topCard, null);
      s.lastAction = null;
      s.players.forEach((p, i) => { p.handCount = hands[i].length; p.calledUno = false; });

      return s;
    }

    if (action.type === 'UNO_NEXT_ROUND') {
      if (s.phase !== 'round_end') throw new Error('INVALID_ACTION: Not in round_end phase');
      if (ctx.playerIndex !== 0) throw new Error('INVALID_ACTION: Only host can start next round');

      // Build and shuffle deck
      let deck = shuffle(buildDeck());
      deck = deck.map((c, i) => ({ ...c, id: i }));
      const nextId = deck.length;

      // Deal hands
      const hands: UnoCard[][] = s.playerIds.map(() => []);
      for (let i = 0; i < UNO_HAND_SIZE; i++) {
        for (let p = 0; p < s.playerIds.length; p++) {
          hands[p].push(deck.pop()!);
        }
      }

      // Flip first non-wild card for discard
      let topCard: UnoCard | undefined;
      const discardPile: UnoCard[] = [];
      while (deck.length > 0) {
        const c = deck.pop()!;
        if (c.type === 'wild' || c.type === 'wild4') {
          deck.unshift(c);
          continue;
        }
        topCard = c;
        discardPile.push(c);
        break;
      }
      if (!topCard) {
        topCard = deck.pop()!;
        discardPile.push(topCard);
      }

      // Apply starting card effects
      let turnIdx = 0;
      let direction: 1 | -1 = 1;
      let pendingDraw = 0;
      const n = s.playerIds.length;

      if (topCard.type === 'skip') {
        turnIdx = ((turnIdx + direction) % n + n) % n;
      } else if (topCard.type === 'reverse') {
        direction = -1;
        if (n === 2) turnIdx = ((turnIdx + direction) % n + n) % n;
      } else if (topCard.type === 'draw2') {
        pendingDraw = 2;
      }

      const nrDrawSrc = pendingDraw > 0 ? 'draw2' as const : null;
      s.phase = 'playing';
      s.hands = hands;
      s.drawPile = deck;
      s.discardPile = discardPile;
      s.topCard = topCard;
      s.chosenColor = null;
      s.turnIndex = turnIdx;
      s.direction = direction;
      s.pendingDraw = pendingDraw;
      s.pendingDrawSource = nrDrawSrc;
      s.currentTurn = s.playerIds[turnIdx];
      s.nextCardId = nextId;
      s.drawnCardId = null;
      s.mustDraw = pendingDraw > 0
        ? !hasStackableCard(hands[turnIdx], nrDrawSrc!, s.rules)
        : !hasPlayableCard(hands[turnIdx], topCard, null);
      s.lastAction = null;
      s.roundNumber += 1;
      s.roundWinner = null;
      s.roundPoints = 0;
      s.status = 'ongoing';
      s.winner = null;
      s.players.forEach((p, i) => { p.handCount = hands[i].length; p.calledUno = false; });

      return s;
    }

    if (s.phase !== 'playing') throw new Error('GAME_NOT_STARTED: Game not in playing phase');

    const pIdx = ctx.playerIndex;
    const myToken = s.playerIds[pIdx];

    if (action.type === 'UNO_CALL_UNO') {
      if (pIdx < 0 || pIdx >= s.players.length) throw new Error('INVALID_ACTION: Not in game');
      s.players[pIdx].calledUno = true;
      s.lastAction = `${s.players[pIdx].nickname || 'Player'} called UNO!`;
      return s;
    }

    // Turn-based actions
    if (myToken !== s.currentTurn) throw new Error('NOT_YOUR_TURN: Not your turn');

    if (action.type === 'UNO_DRAW_CARD') {
      // If in drawn-card-playable window, drawing again means declining to play it
      if (s.drawnCardId !== null) {
        s.drawnCardId = null;
        advanceTurn(s);
        s.pendingDrawSource = null;
        s.mustDraw = s.pendingDraw > 0
          ? (s.pendingDrawSource ? !hasStackableCard(s.hands[s.turnIndex], s.pendingDrawSource, s.rules) : true)
          : !hasPlayableCard(s.hands[s.turnIndex], s.topCard, s.chosenColor);
        return s;
      }

      // Forced play: cannot voluntarily draw if you have a playable card (unless pending draw)
      if (s.rules.forcedPlay && s.pendingDraw === 0 && hasPlayableCard(s.hands[pIdx], s.topCard, s.chosenColor)) {
        throw new Error('INVALID_ACTION: You have a playable card and must play it');
      }

      if (s.pendingDraw > 0) {
        // Penalty draw: draw all pending cards at once
        const count = s.pendingDraw;
        drawCards(s, pIdx, count);
        s.pendingDraw = 0;
        s.pendingDrawSource = null;
        s.players[pIdx].calledUno = false;
        s.lastAction = `${s.players[pIdx].nickname || 'Player'} drew ${count} card${count > 1 ? 's' : ''}`;
        advanceTurn(s);
        s.mustDraw = !hasPlayableCard(s.hands[s.turnIndex], s.topCard, s.chosenColor);
        return s;
      }

      // Normal draw (no pending)
      if (s.rules.drawUntilPlayable) {
        // Draw-to-match: keep drawing until a playable card is found
        let totalDrawn = 0;
        let lastPlayable: UnoCard | null = null;
        while (true) {
          const beforeLen = s.hands[pIdx].length;
          drawCards(s, pIdx, 1);
          if (s.hands[pIdx].length === beforeLen) break; // draw pile exhausted
          totalDrawn++;
          const drawn = s.hands[pIdx][s.hands[pIdx].length - 1];
          if (canPlayCard(drawn, s.topCard, s.chosenColor)) {
            lastPlayable = drawn;
            break;
          }
        }
        s.players[pIdx].calledUno = false;
        s.lastAction = `${s.players[pIdx].nickname || 'Player'} drew ${totalDrawn} card${totalDrawn > 1 ? 's' : ''}`;

        // If the last drawn card is playable and playDrawnCardImmediately is on, offer it
        if (lastPlayable && s.rules.playDrawnCardImmediately) {
          s.drawnCardId = lastPlayable.id;
          s.mustDraw = false;
          return s;
        }

        advanceTurn(s);
        s.mustDraw = !hasPlayableCard(s.hands[s.turnIndex], s.topCard, s.chosenColor);
        return s;
      }

      // Standard: draw exactly 1
      drawCards(s, pIdx, 1);
      s.players[pIdx].calledUno = false;
      s.lastAction = `${s.players[pIdx].nickname || 'Player'} drew 1 card`;

      // playDrawnCardImmediately: if drew 1 card and it's playable, keep turn
      if (s.rules.playDrawnCardImmediately) {
        const drawnCard = s.hands[pIdx][s.hands[pIdx].length - 1];
        if (canPlayCard(drawnCard, s.topCard, s.chosenColor)) {
          s.drawnCardId = drawnCard.id;
          s.mustDraw = false;
          return s;
        }
      }

      // Advance turn
      advanceTurn(s);
      s.mustDraw = !hasPlayableCard(s.hands[s.turnIndex], s.topCard, s.chosenColor);
      return s;
    }

    if (action.type === 'UNO_PLAY_CARD') {
      // If in drawn-card-playable window, only the drawn card may be played
      if (s.drawnCardId !== null) {
        if (action.cardId !== s.drawnCardId) {
          throw new Error('INVALID_ACTION: Only the drawn card may be played now');
        }
      }

      // Must draw if there are pending draws — check stacking via rules
      if (s.pendingDraw > 0 && s.drawnCardId === null) {
        const card = s.hands[pIdx].find(c => c.id === action.cardId);
        if (!card) throw new Error('INVALID_ACTION: Card not in hand');
        if (!s.pendingDrawSource || !canStackCard(card, s.pendingDrawSource, s.rules)) {
          throw new Error('INVALID_ACTION: Must draw or stack');
        }
      }

      const cardIdx = s.hands[pIdx].findIndex(c => c.id === action.cardId);
      if (cardIdx === -1) throw new Error('INVALID_ACTION: Card not in hand');
      const card = s.hands[pIdx][cardIdx];

      // Check playability (skip if playing drawn card or stacking on pending draw — already validated above)
      if (s.drawnCardId === null && !(s.pendingDraw > 0 && s.pendingDrawSource) && !canPlayCard(card, s.topCard, s.chosenColor)) {
        throw new Error('INVALID_ACTION: Card cannot be played');
      }

      // Wild cards require color choice
      if ((card.type === 'wild' || card.type === 'wild4') && !action.chosenColor) {
        throw new Error('INVALID_ACTION: Must choose a color for wild card');
      }

      // Clear drawn card window
      s.drawnCardId = null;

      // Remove card from hand
      s.hands[pIdx].splice(cardIdx, 1);
      s.players[pIdx].handCount = s.hands[pIdx].length;

      // Place on discard
      s.discardPile.push(card);
      s.topCard = card;

      // UNO penalty check: previous player had 1 card without calling UNO
      // (checked before this player's action takes effect on others)
      for (let i = 0; i < s.players.length; i++) {
        if (i !== pIdx && s.hands[i].length === 1 && !s.players[i].calledUno) {
          drawCards(s, i, UNO_PENALTY_CARDS);
          s.lastAction = `${s.players[i].nickname || 'Player'} forgot UNO! +${UNO_PENALTY_CARDS}`;
          s.players[i].calledUno = false;
        }
      }

      // Reset calledUno for the playing player (they just played a card)
      // They need to call UNO again if they reach 1 card
      if (s.hands[pIdx].length !== 1) {
        s.players[pIdx].calledUno = false;
      }

      // Check win — round over
      if (s.hands[pIdx].length === 0) {
        // If winning card is a draw card, force next player to draw before scoring
        if (card.type === 'draw2' || card.type === 'wild4') {
          const drawCount = card.type === 'draw2' ? 2 + s.pendingDraw : 4 + s.pendingDraw;
          const nextIdx = ((s.turnIndex + s.direction) % s.playerIds.length + s.playerIds.length) % s.playerIds.length;
          drawCards(s, nextIdx, drawCount);
          s.pendingDraw = 0;
          s.pendingDrawSource = null;
        }

        const points = scoreHands(s.hands, pIdx);
        s.players[pIdx].matchScore += points;
        s.roundWinner = myToken;
        s.roundPoints = points;
        s.lastAction = `${s.players[pIdx].nickname || 'Player'} wins the round! (+${points})`;

        if (s.players[pIdx].matchScore >= s.matchTargetScore) {
          s.phase = 'match_end';
          s.status = 'win';
          s.winner = myToken;
        } else {
          s.phase = 'round_end';
          s.status = 'ongoing';
          s.winner = null;
        }
        return s;
      }

      // Apply card effects
      if (card.type === 'wild' || card.type === 'wild4') {
        s.chosenColor = action.chosenColor!;
      } else {
        s.chosenColor = null;
      }

      if (card.type === 'skip') {
        s.lastAction = `${s.players[pIdx].nickname || 'Player'} played Skip!`;
        advanceTurn(s, 2); // skip next player
      } else if (card.type === 'reverse') {
        s.lastAction = `${s.players[pIdx].nickname || 'Player'} played Reverse!`;
        s.direction = (s.direction * -1) as 1 | -1;
        if (s.playerIds.length === 2) {
          // 2-player: reverse acts as skip
          advanceTurn(s, 2);
        } else {
          advanceTurn(s);
        }
      } else if (card.type === 'draw2') {
        s.pendingDraw += 2;
        s.pendingDrawSource = 'draw2';
        s.lastAction = `${s.players[pIdx].nickname || 'Player'} played +2!`;
        advanceTurn(s);
      } else if (card.type === 'wild4') {
        s.pendingDraw += 4;
        s.pendingDrawSource = 'wild4';
        s.lastAction = `${s.players[pIdx].nickname || 'Player'} played Wild +4!`;
        advanceTurn(s);
      } else if (card.type === 'wild') {
        s.pendingDrawSource = null;
        s.lastAction = `${s.players[pIdx].nickname || 'Player'} played Wild!`;
        advanceTurn(s);
      } else {
        s.pendingDrawSource = null;
        s.lastAction = null;
        advanceTurn(s);
      }

      if (s.pendingDraw > 0 && s.pendingDrawSource) {
        s.mustDraw = !hasStackableCard(s.hands[s.turnIndex], s.pendingDrawSource, s.rules);
      } else {
        s.mustDraw = !hasPlayableCard(s.hands[s.turnIndex], s.topCard, s.chosenColor);
      }
      return s;
    }

    if (action.type === 'UNO_PLAY_STACK') {
      if (!s.rules.stackSameCards) throw new Error('INVALID_ACTION: Stack same cards rule is not enabled');
      if (s.drawnCardId !== null) throw new Error('INVALID_ACTION: Cannot stack during drawn card window');
      if (!action.cardIds || action.cardIds.length < 2) throw new Error('INVALID_ACTION: Must play at least 2 cards');

      // Validate all cards are in hand
      const cards: UnoCard[] = [];
      for (const cid of action.cardIds) {
        const c = s.hands[pIdx].find(h => h.id === cid);
        if (!c) throw new Error('INVALID_ACTION: Card not in hand');
        cards.push(c);
      }

      // Validate all cards are same color AND same value (number cards only)
      const first = cards[0];
      if (first.type !== 'number') throw new Error('INVALID_ACTION: Only number cards can be stacked');
      for (let i = 1; i < cards.length; i++) {
        if (cards[i].type !== first.type || cards[i].color !== first.color || cards[i].value !== first.value) {
          throw new Error('INVALID_ACTION: All stacked cards must have the same color and value');
        }
      }

      // Validate first card is playable (or stackable if pending draw)
      if (s.pendingDraw > 0) {
        throw new Error('INVALID_ACTION: Cannot stack same cards while there are pending draws');
      }
      if (!canPlayCard(first, s.topCard, s.chosenColor)) {
        throw new Error('INVALID_ACTION: Card cannot be played');
      }

      // Remove all cards from hand (iterate in reverse to keep indices stable)
      const idsToRemove = new Set(action.cardIds);
      s.hands[pIdx] = s.hands[pIdx].filter(c => !idsToRemove.has(c.id));
      s.players[pIdx].handCount = s.hands[pIdx].length;

      // Place last card on discard (all go to discard, last is topCard)
      const lastCard = cards[cards.length - 1];
      for (const c of cards) s.discardPile.push(c);
      s.topCard = lastCard;
      s.chosenColor = null;

      // UNO penalty check
      for (let i = 0; i < s.players.length; i++) {
        if (i !== pIdx && s.hands[i].length === 1 && !s.players[i].calledUno) {
          drawCards(s, i, UNO_PENALTY_CARDS);
          s.lastAction = `${s.players[i].nickname || 'Player'} forgot UNO! +${UNO_PENALTY_CARDS}`;
          s.players[i].calledUno = false;
        }
      }

      if (s.hands[pIdx].length !== 1) {
        s.players[pIdx].calledUno = false;
      }

      // Check win
      if (s.hands[pIdx].length === 0) {
        const points = scoreHands(s.hands, pIdx);
        s.players[pIdx].matchScore += points;
        s.roundWinner = myToken;
        s.roundPoints = points;
        s.lastAction = `${s.players[pIdx].nickname || 'Player'} wins the round! (+${points})`;

        if (s.players[pIdx].matchScore >= s.matchTargetScore) {
          s.phase = 'match_end';
          s.status = 'win';
          s.winner = myToken;
        } else {
          s.phase = 'round_end';
          s.status = 'ongoing';
          s.winner = null;
        }
        return s;
      }

      s.lastAction = `${s.players[pIdx].nickname || 'Player'} played ${cards.length}x ${first.color} ${first.value}!`;
      s.pendingDrawSource = null;
      advanceTurn(s);

      if (s.pendingDraw > 0 && s.pendingDrawSource) {
        s.mustDraw = !hasStackableCard(s.hands[s.turnIndex], s.pendingDrawSource, s.rules);
      } else {
        s.mustDraw = !hasPlayableCard(s.hands[s.turnIndex], s.topCard, s.chosenColor);
      }
      return s;
    }

    throw new Error('INVALID_ACTION: Unknown action type');
  },

  getStatus(state: UnoState): StatusResult {
    const status: GameStatus = state.phase === 'match_end' ? 'win' : 'ongoing';
    return {
      status,
      winner: state.winner ?? undefined,
    };
  },
};
