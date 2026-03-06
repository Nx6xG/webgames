import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { MinesweeperGame } from '@/components/games/minesweeper/MinesweeperGame';

export const metadata: Metadata = {
  title: 'Minesweeper — Web Games',
};

export default function MinesweeperPage() {
  return (
    <GamePage title="Minesweeper">
      <MinesweeperGame />
    </GamePage>
  );
}
