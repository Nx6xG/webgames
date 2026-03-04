import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { TetrisGame } from '@/components/games/tetris/TetrisGame';

export const metadata: Metadata = {
  title: 'Tetris — Web Games',
};

export default function TetrisPage() {
  return (
    <GamePage title="Tetris">
      <TetrisGame />
    </GamePage>
  );
}
