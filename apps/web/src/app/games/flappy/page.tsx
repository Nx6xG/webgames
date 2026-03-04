import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { FlappyGame } from '@/components/games/flappy/FlappyGame';

export const metadata: Metadata = {
  title: 'Flappy Bird — Web Games',
};

export default function FlappyPage() {
  return (
    <GamePage title="Flappy Bird">
      <FlappyGame />
    </GamePage>
  );
}
