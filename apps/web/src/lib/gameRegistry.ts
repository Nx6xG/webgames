import type { ComponentType } from 'react';
import dynamic from 'next/dynamic';
import type { GameId, GameManifest } from 'shared';

const TicTacToeGame = dynamic(() => import('@/components/games/tictactoe/TicTacToeGame').then(m => m.TicTacToeGame));
const Connect4Game = dynamic(() => import('@/components/games/connect4/Connect4Game').then(m => m.Connect4Game));
const RpsGame = dynamic(() => import('@/components/games/rps/RpsGame').then(m => m.RpsGame));
const ChessGame = dynamic(() => import('@/components/games/chess/ChessGame').then(m => m.ChessGame));
const BattleshipGame = dynamic(() => import('@/components/games/battleship/BattleshipGame').then(m => m.BattleshipGame));
const LiarsBarGame = dynamic(() => import('@/components/games/liarsbar/LiarsBarGame').then(m => m.LiarsBarGame));
const CurveFeverGame = dynamic(() => import('@/components/games/curvefever/CurveFeverGame').then(m => m.CurveFeverGame));
const UnoGame = dynamic(() => import('@/components/games/uno/UnoGame').then(m => m.UnoGame));

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
      /** When true, GamePage uses full viewport width (no max-w-6xl). */
      fullWidth?: boolean;
    }
  | {
      manifest: GameManifest;
      titleKey: string;
      descKey: string;
      /** Mark as coming-soon: card is shown but Play is disabled; /games/[id] shows a placeholder. */
      comingSoon: true;
      Component?: never;
      fullWidth?: boolean;
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
      categories: ['classic', '2 players', 'multiplayer', 'vs bot'],
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
      categories: ['classic', 'strategy', '2 players', 'vs bot'],
      version: '1.0.0',
      routeSlug: 'chess',
      minPlayers: 2,
      maxPlayers: 2,
    },
    titleKey: 'lobby.games.chess.title',
    descKey:  'lobby.games.chess.desc',
    Component: ChessGame,
  },
  battleship: {
    manifest: {
      id: 'battleship',
      name: 'Battleship',
      description: 'Place your fleet and sink the enemy before they sink you!',
      categories: ['classic', 'strategy', '2 players', 'vs bot'],
      version: '1.0.0',
      routeSlug: 'battleship',
      minPlayers: 2,
      maxPlayers: 2,
    },
    titleKey: 'lobby.games.battleship.title',
    descKey:  'lobby.games.battleship.desc',
    Component: BattleshipGame,
  },
  liarsbar: {
    manifest: {
      id: 'liarsbar',
      name: "Liar's Deck",
      description: 'Bluff your way through with face-down cards. Get called out and lose a life!',
      categories: ['cards', 'bluff', 'multiplayer'],
      version: '1.0.0',
      routeSlug: 'liarsbar',
      minPlayers: 2,
      maxPlayers: 6,
    },
    titleKey: 'lobby.games.liarsbar.title',
    descKey:  'lobby.games.liarsbar.desc',
    Component: LiarsBarGame,
  },
  curvefever: {
    manifest: {
      id: 'curvefever',
      name: 'Curve Fever',
      description: 'Steer your snake and be the last one alive! 2-6 players real-time action.',
      categories: ['multiplayer', 'arcade', 'vs bot'],
      version: '1.0.0',
      routeSlug: 'curvefever',
      minPlayers: 2,
      maxPlayers: 6,
    },
    titleKey: 'lobby.games.curvefever.title',
    descKey:  'lobby.games.curvefever.desc',
    Component: CurveFeverGame,
    fullWidth: true,
  },
  uno: {
    manifest: {
      id: 'uno',
      name: 'UNO',
      description: 'Classic card game! Match colors and numbers, play action cards, and be first to empty your hand.',
      categories: ['cards', 'multiplayer', 'classic'],
      version: '1.0.0',
      routeSlug: 'uno',
      minPlayers: 2,
      maxPlayers: 4,
    },
    titleKey: 'lobby.games.uno.title',
    descKey:  'lobby.games.uno.desc',
    Component: UnoGame,
  },
};
