import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { PongGame } from '@/components/games/pong/PongGame';

export const metadata: Metadata = {
  title: 'Pong — Web Games',
};

export default function PongPage() {
  return (
    <GamePage title="Pong">
      <PongGame />
    </GamePage>
  );
}
