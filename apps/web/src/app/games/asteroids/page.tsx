import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { AsteroidsGame } from '@/components/games/asteroids/AsteroidsGame';

export const metadata: Metadata = {
  title: 'Asteroids — Web Games',
};

export default function AsteroidsPage() {
  return (
    <GamePage title="Asteroids">
      <AsteroidsGame />
    </GamePage>
  );
}
