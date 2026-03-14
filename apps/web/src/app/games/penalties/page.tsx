import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { PenaltiesGame } from '@/components/games/penalties/PenaltiesGame';

export const metadata: Metadata = {
  title: 'Elfmeterschießen — Web Games',
};

export default function PenaltiesPage() {
  return (
    <GamePage title="Elfmeterschießen">
      <PenaltiesGame />
    </GamePage>
  );
}
