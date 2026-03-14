import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { GeometryDashGame } from '@/components/games/geometrydash/GeometryDashGame';

export const metadata: Metadata = {
  title: 'Geometry Dash — Web Games',
};

export default function GeometryDashPage() {
  return (
    <GamePage title="Geometry Dash">
      <GeometryDashGame />
    </GamePage>
  );
}
