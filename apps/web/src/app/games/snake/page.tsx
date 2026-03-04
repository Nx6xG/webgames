import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { SnakeGame } from '@/components/games/snake/SnakeGame';

export const metadata: Metadata = {
  title: 'Snake — Web Games',
};

export default function SnakePage() {
  return (
    <GamePage title="Snake">
      <SnakeGame />
    </GamePage>
  );
}
