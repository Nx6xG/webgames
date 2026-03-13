import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { CrossyRoadGame } from '@/components/games/crossyroad/CrossyRoadGame';

export const metadata: Metadata = {
  title: 'Crossy Road — Web Games',
};

export default function CrossyRoadPage() {
  return (
    <GamePage title="Crossy Road">
      <CrossyRoadGame />
    </GamePage>
  );
}
