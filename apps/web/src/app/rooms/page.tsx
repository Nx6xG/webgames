import type { Metadata } from 'next';
import { RoomsClient } from '@/components/RoomsClient';

export const metadata: Metadata = { title: 'Open Rooms — Web Games' };

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? '';
  const { game } = await searchParams;
  return <RoomsClient wsUrl={wsUrl} initialGameFilter={game} />;
}
