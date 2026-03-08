import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';

function getWsInternalUrl(): string {
  return process.env.WS_INTERNAL_URL ?? process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const secret = process.env.ADMIN_API_SECRET;
  if (!secret) return NextResponse.json({ error: 'Admin API not configured' }, { status: 500 });

  try {
    const res = await fetch(`${getWsInternalUrl()}/admin/rooms`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) return NextResponse.json({ error: 'WS server error' }, { status: res.status });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Cannot reach WS server' }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const secret = process.env.ADMIN_API_SECRET;
  if (!secret) return NextResponse.json({ error: 'Admin API not configured' }, { status: 500 });

  const { roomCode } = await request.json();
  if (!roomCode) return NextResponse.json({ error: 'Missing roomCode' }, { status: 400 });

  try {
    const res = await fetch(`${getWsInternalUrl()}/admin/rooms/close`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roomCode }),
    });
    if (!res.ok) return NextResponse.json({ error: 'WS server error' }, { status: res.status });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Cannot reach WS server' }, { status: 502 });
  }
}
