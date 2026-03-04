import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { SudokuGame } from '@/components/games/sudoku/SudokuGame';

export const metadata: Metadata = {
  title: 'Sudoku — Web Games',
};

export default function SudokuPage() {
  return (
    <GamePage title="Sudoku">
      <SudokuGame />
    </GamePage>
  );
}
