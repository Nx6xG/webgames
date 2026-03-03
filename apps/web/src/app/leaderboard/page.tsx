import type { Metadata } from 'next';
import { LeaderboardClient } from '@/components/LeaderboardClient';

export const metadata: Metadata = { title: 'Leaderboard — Web Games' };

export default function LeaderboardPage() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? '';
  return <LeaderboardClient wsUrl={wsUrl} />;
}
