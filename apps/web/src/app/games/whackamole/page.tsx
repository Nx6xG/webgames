import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { WhackAMoleGame } from '@/components/games/whackamole/WhackAMoleGame';

export const metadata: Metadata = {
  title: 'Whack-a-Mole — Web Games',
};

export default function WhackAMolePage() {
  return (
    <GamePage title="Whack-a-Mole">
      <WhackAMoleGame />
    </GamePage>
  );
}
