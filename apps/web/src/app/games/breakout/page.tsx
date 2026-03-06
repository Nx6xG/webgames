import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { BreakoutGame } from '@/components/games/breakout/BreakoutGame';

export const metadata: Metadata = {
  title: 'Breakout — Web Games',
};

export default function BreakoutPage() {
  return (
    <GamePage title="Breakout">
      <BreakoutGame />
    </GamePage>
  );
}
