import type { ComponentType } from 'react';
import type { GameId, GameManifest } from 'shared';
import { TicTacToeGame } from '@/components/games/tictactoe/TicTacToeGame';
import { Connect4Game } from '@/components/games/connect4/Connect4Game';
import { RpsGame } from '@/components/games/rps/RpsGame';
import { ChessGame } from '@/components/games/chess/ChessGame';

/**
 * Props every game component must accept.
 * Implement this interface when creating a new game UI.
 */
export interface GameComponentProps {
  wsUrl: string;
  gameId: GameId;
  initialRoomCode?: string;
  /** When true the component auto-emits quick_play on connect instead of showing lobby UI */
  quickPlay?: boolean;
}

type WebGameEntry =
  | {
      manifest: GameManifest;
      /**
       * i18n key for the game title shown in the lobby card (e.g. 'lobby.games.chess.title').
       * Looked up via t(titleKey) — do NOT store translated strings here directly.
       */
      titleKey: string;
      /**
       * i18n key for the game description shown in the lobby card (e.g. 'lobby.games.chess.desc').
       * Looked up via t(descKey) — do NOT store translated strings here directly.
       */
      descKey: string;
      comingSoon?: false;
      /** Top-level game component rendered inside GamePage. */
      Component: ComponentType<GameComponentProps>;
    }
  | {
      manifest: GameManifest;
      titleKey: string;
      descKey: string;
      /** Mark as coming-soon: card is shown but Play is disabled; /games/[id] shows a placeholder. */
      comingSoon: true;
      Component?: never;
    };

export type { WebGameEntry };

/**
 * Central web registry — maps every GameId to its manifest and React component.
 *
 * manifest.name / manifest.description hold English strings used for:
 *   - <title> metadata (server-side, no i18n context available)
 *   - GamePage breadcrumb header (server component)
 *
 * For translated display in lobby cards, use titleKey / descKey with useI18n().t().
 *
 * Adding a new game: import the component, add titleKey/descKey i18n messages, then
 * register one entry here.
 */
export const webRegistry: Record<GameId, WebGameEntry> = {
  tictactoe: {
    manifest: {
      id: 'tictactoe',
      name: 'Tic-Tac-Toe',
      description: 'Classic 3×3 strategy game. Get three in a row to win!',
      categories: ['classic', 'strategy', '2 players'],
      version: '1.0.0',
      routeSlug: 'tictactoe',
      minPlayers: 2,
      maxPlayers: 2,
    },
    titleKey: 'lobby.games.tictactoe.title',
    descKey:  'lobby.games.tictactoe.desc',
    Component: TicTacToeGame,
  },
  connect4: {
    manifest: {
      id: 'connect4',
      name: 'Connect Four',
      description: 'Drop pieces into a 7×6 grid. First to connect four in a row wins!',
      categories: ['classic', 'strategy', '2 players'],
      version: '1.0.0',
      routeSlug: 'connect4',
      minPlayers: 2,
      maxPlayers: 2,
    },
    titleKey: 'lobby.games.connect4.title',
    descKey:  'lobby.games.connect4.desc',
    Component: Connect4Game,
  },
  rps: {
    manifest: {
      id: 'rps',
      name: 'Rock Paper Scissors',
      description: 'Choose your weapon in this simultaneous best-of-3 showdown!',
      categories: ['classic', '2 players', 'multiplayer'],
      version: '1.0.0',
      routeSlug: 'rps',
      minPlayers: 2,
      maxPlayers: 2,
    },
    titleKey: 'lobby.games.rps.title',
    descKey:  'lobby.games.rps.desc',
    Component: RpsGame,
  },
  chess: {
    manifest: {
      id: 'chess',
      name: 'Chess',
      description: 'Classic strategy game. Outthink your opponent and deliver checkmate.',
      categories: ['classic', 'strategy', '2 players'],
      version: '1.0.0',
      routeSlug: 'chess',
      minPlayers: 2,
      maxPlayers: 2,
    },
    titleKey: 'lobby.games.chess.title',
    descKey:  'lobby.games.chess.desc',
    Component: ChessGame,
  },
};
