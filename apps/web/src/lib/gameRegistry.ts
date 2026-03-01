import type { ComponentType } from 'react';
import type { GameId, GameManifest } from 'shared';
import { TicTacToeGame } from '@/components/games/tictactoe/TicTacToeGame';
import { Connect4Game } from '@/components/games/connect4/Connect4Game';
import { RpsGame } from '@/components/games/rps/RpsGame';

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
      comingSoon?: false;
      /** Top-level game component rendered inside GamePage. */
      Component: ComponentType<GameComponentProps>;
    }
  | {
      manifest: GameManifest;
      /** Mark as coming-soon: card is shown but Play is disabled; /games/[id] shows a placeholder. */
      comingSoon: true;
      Component?: never;
    };

export type { WebGameEntry };

/**
 * Central web registry — maps every GameId to its manifest and React component.
 * Adding a new game: import the component and add one entry here.
 * For a coming-soon stub: omit Component and set comingSoon: true.
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
    Component: RpsGame,
  },
};
