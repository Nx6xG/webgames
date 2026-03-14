import type { Metadata } from 'next';
import { GamePage } from '@/components/GamePage';
import { TypingTestGame } from '@/components/games/typingtest/TypingTestGame';

export const metadata: Metadata = { title: 'Typing Test — Web Games' };

export default function TypingTestPage() {
  return (
    <GamePage title="Typing Test">
      <TypingTestGame />
    </GamePage>
  );
}
