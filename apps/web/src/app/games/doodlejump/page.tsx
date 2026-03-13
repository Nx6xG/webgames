import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { DoodleJumpGame } from '@/components/games/doodlejump/DoodleJumpGame';

export const metadata: Metadata = {
  title: 'Doodle Jump — Web Games',
};

export default function DoodleJumpPage() {
  return (
    <GamePage title="Doodle Jump">
      <DoodleJumpGame />
    </GamePage>
  );
}
