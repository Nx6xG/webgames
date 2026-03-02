import type { Metadata } from 'next';
import { RoomsClient } from '@/components/RoomsClient';

export const metadata: Metadata = { title: 'Open Rooms — Web Games' };

export default function RoomsPage() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';
  return <RoomsClient wsUrl={wsUrl} />;
}
