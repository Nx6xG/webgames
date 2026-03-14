import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { FruitNinjaGame } from '@/components/games/fruitninja/FruitNinjaGame';

export const metadata: Metadata = {
  title: 'Fruit Ninja — Web Games',
};

export default function FruitNinjaPage() {
  return (
    <GamePage title="Fruit Ninja">
      <FruitNinjaGame />
    </GamePage>
  );
}
