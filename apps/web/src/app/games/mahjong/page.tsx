import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { MahjongGame } from '@/components/games/mahjong/MahjongGame';

export const metadata: Metadata = {
  title: 'Mahjong — Web Games',
};

export default function MahjongPage() {
  return (
    <GamePage title="Mahjong">
      <MahjongGame />
    </GamePage>
  );
}
