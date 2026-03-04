import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { Game2048 } from '@/components/games/2048/Game2048';

export const metadata: Metadata = {
  title: '2048 — Web Games',
};

export default function Game2048Page() {
  return (
    <GamePage title="2048">
      <Game2048 />
    </GamePage>
  );
}
