'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { fetchRooms, closeRoom } from '@/lib/adminApi';

interface RoomInfo {
  code: string;
  gameId: string;
  visibility: string;
  roomName?: string;
  players: { index: number; nickname: string; playerToken: string }[];
  spectators: number;
  createdAt: number;
  hasState: boolean;
}

export default function AdminRoomsPage() {
  const { t } = useI18n();
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRooms();
      setRooms(res.rooms ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleClose(code: string) {
    if (closing) return;
    setClosing(code);
    try {
      await closeRoom(code);
      await load();
    } catch {
      /* ignore */
    } finally {
      setClosing(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t('admin.nav.rooms')}</h1>
        <button onClick={load} disabled={loading} className="px-3 py-1 rounded-md border border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50">
          {t('admin.rooms.refresh')}
        </button>
      </div>

      {error && <p className="text-rose-400 text-xs">{error}</p>}

      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-zinc-900 text-zinc-500 text-left">
              <th className="px-3 py-2 font-medium">{t('admin.rooms.code')}</th>
              <th className="px-3 py-2 font-medium">{t('admin.rooms.game')}</th>
              <th className="px-3 py-2 font-medium">{t('admin.rooms.visibility')}</th>
              <th className="px-3 py-2 font-medium">{t('admin.rooms.players')}</th>
              <th className="px-3 py-2 font-medium">{t('admin.rooms.spectators')}</th>
              <th className="px-3 py-2 font-medium">{t('admin.rooms.state')}</th>
              <th className="px-3 py-2 font-medium">{t('admin.rooms.created')}</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-zinc-600">{t('admin.loading')}</td></tr>
            ) : rooms.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-zinc-600">{t('admin.rooms.noRooms')}</td></tr>
            ) : (
              rooms.map((r) => (
                <tr key={r.code} className="border-t border-zinc-800 hover:bg-zinc-900/50 transition-colors">
                  <td className="px-3 py-2 font-mono text-zinc-300">{r.code}</td>
                  <td className="px-3 py-2 text-zinc-300">{r.gameId}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      r.visibility === 'public' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {r.visibility}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {r.players.map((p) => p.nickname).join(', ') || '—'}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{r.spectators}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-semibold ${r.hasState ? 'text-emerald-400' : 'text-zinc-600'}`}>
                      {r.hasState ? t('admin.rooms.playing') : t('admin.rooms.lobby')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{new Date(r.createdAt).toLocaleTimeString()}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleClose(r.code)}
                      disabled={closing === r.code}
                      className="px-2 py-0.5 rounded border border-rose-800 text-rose-400 text-[10px] font-semibold hover:bg-rose-900/30 transition-colors disabled:opacity-50"
                    >
                      {t('admin.rooms.close')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
