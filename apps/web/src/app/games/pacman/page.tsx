import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { PacmanGame } from '@/components/games/pacman/PacmanGame';

export const metadata: Metadata = {
  title: 'Pac-Man — Web Games',
};

export default function PacmanPage() {
  return (
    <GamePage title="Pac-Man">
      <PacmanGame />
    </GamePage>
  );
}
