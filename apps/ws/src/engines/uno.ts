import type { GameEngine, ActionContext, StatusResult, GameStatus } from 'shared';
import type { UnoState, UnoAction, UnoCard, UnoColor, UnoPlayer } from 'shared';
import { UNO_HAND_SIZE, UNO_PENALTY_CARDS } from 'shared';

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

// ── Engine ──────────────────────────────────────────────────────────────────

export const unoEngine: GameEngine<UnoState, UnoAction> = {
  initialState(playerIds: string[], startingPlayerIndex: number = 0): UnoState {
    const players: UnoPlayer[] = playerIds.map(token => ({
      token,
      nickname: '',
      handCount: 0,
      calledUno: false,
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

      s.phase = 'playing';
      s.hands = hands;
      s.drawPile = deck;
      s.discardPile = discardPile;
      s.topCard = topCard;
      s.chosenColor = null;
      s.turnIndex = turnIdx;
      s.direction = direction;
      s.pendingDraw = pendingDraw;
      s.currentTurn = s.playerIds[turnIdx];
      s.nextCardId = nextId;
      s.mustDraw = pendingDraw > 0 ? true : !hasPlayableCard(hands[turnIdx], topCard, null);
      s.lastAction = null;
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
      const count = s.pendingDraw > 0 ? s.pendingDraw : 1;
      drawCards(s, pIdx, count);
      s.pendingDraw = 0;
      s.players[pIdx].calledUno = false;
      s.lastAction = `${s.players[pIdx].nickname || 'Player'} drew ${count} card${count > 1 ? 's' : ''}`;

      // Advance turn
      advanceTurn(s);
      s.mustDraw = !hasPlayableCard(s.hands[s.turnIndex], s.topCard, s.chosenColor);
      return s;
    }

    if (action.type === 'UNO_PLAY_CARD') {
      // Must draw if there are pending draws
      if (s.pendingDraw > 0 && action.cardId !== undefined) {
        // Allow stacking draw2 on draw2, or wild4 on wild4/draw2
        const card = s.hands[pIdx].find(c => c.id === action.cardId);
        if (!card) throw new Error('INVALID_ACTION: Card not in hand');
        if (s.pendingDraw > 0 && card.type !== 'draw2' && card.type !== 'wild4') {
          throw new Error('INVALID_ACTION: Must draw or stack');
        }
      }

      const cardIdx = s.hands[pIdx].findIndex(c => c.id === action.cardId);
      if (cardIdx === -1) throw new Error('INVALID_ACTION: Card not in hand');
      const card = s.hands[pIdx][cardIdx];

      // Check playability
      if (!canPlayCard(card, s.topCard, s.chosenColor)) {
        throw new Error('INVALID_ACTION: Card cannot be played');
      }

      // Wild cards require color choice
      if ((card.type === 'wild' || card.type === 'wild4') && !action.chosenColor) {
        throw new Error('INVALID_ACTION: Must choose a color for wild card');
      }

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

      // Check win
      if (s.hands[pIdx].length === 0) {
        s.phase = 'finished';
        s.status = 'win';
        s.winner = myToken;
        s.lastAction = `${s.players[pIdx].nickname || 'Player'} wins!`;
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
        s.lastAction = `${s.players[pIdx].nickname || 'Player'} played +2!`;
        advanceTurn(s);
      } else if (card.type === 'wild4') {
        s.pendingDraw += 4;
        s.lastAction = `${s.players[pIdx].nickname || 'Player'} played Wild +4!`;
        advanceTurn(s);
      } else if (card.type === 'wild') {
        s.lastAction = `${s.players[pIdx].nickname || 'Player'} played Wild!`;
        advanceTurn(s);
      } else {
        s.lastAction = null;
        advanceTurn(s);
      }

      s.mustDraw = s.pendingDraw > 0 ? true : !hasPlayableCard(s.hands[s.turnIndex], s.topCard, s.chosenColor);
      return s;
    }

    throw new Error('INVALID_ACTION: Unknown action type');
  },

  getStatus(state: UnoState): StatusResult {
    const status: GameStatus = state.phase === 'finished' ? 'win' : 'ongoing';
    return {
      status,
      winner: state.winner ?? undefined,
    };
  },
};
