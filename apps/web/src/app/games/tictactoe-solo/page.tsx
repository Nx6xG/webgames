import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { TicTacToeSolo } from '@/components/games/tictactoe_solo/TicTacToeSolo';

export const metadata: Metadata = {
  title: 'TicTacToe — Web Games',
};

export default function TicTacToeSoloPage() {
  return (
    <GamePage title="TicTacToe">
      <TicTacToeSolo />
    </GamePage>
  );
}
