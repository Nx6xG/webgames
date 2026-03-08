'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { fetchUsers, fetchRooms, fetchAuditLog } from '@/lib/adminApi';

interface DashboardData {
  totalUsers: number;
  activeRooms: number;
  recentActions: { id: number; admin_nickname: string; action: string; created_at: string }[];
}

export default function AdminDashboard() {
  const { t } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [usersRes, roomsRes, auditRes] = await Promise.all([
          fetchUsers('', 1, 1),
          fetchRooms().catch(() => ({ rooms: [] })),
          fetchAuditLog(1, 5),
        ]);
        setData({
          totalUsers: usersRes.total ?? 0,
          activeRooms: roomsRes.rooms?.length ?? 0,
          recentActions: auditRes.entries ?? [],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    }
    load();
  }, []);

  if (error) return <p className="text-rose-400 text-sm">{error}</p>;
  if (!data) return <p className="text-zinc-500 text-sm">{t('admin.loading')}</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">{t('admin.nav.dashboard')}</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={t('admin.stats.totalUsers')} value={data.totalUsers} />
        <StatCard label={t('admin.stats.activeRooms')} value={data.activeRooms} />
        <StatCard label={t('admin.stats.recentActions')} value={data.recentActions.length} />
      </div>

      {/* Recent audit log */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-400 mb-2">{t('admin.recentActivity')}</h2>
        {data.recentActions.length === 0 ? (
          <p className="text-xs text-zinc-600">{t('admin.noActivity')}</p>
        ) : (
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <tbody>
                {data.recentActions.map((a) => (
                  <tr key={a.id} className="border-b border-zinc-800 last:border-0">
                    <td className="px-3 py-2 text-zinc-500">{new Date(a.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 text-zinc-300">{a.admin_nickname}</td>
                    <td className="px-3 py-2 text-zinc-100 font-mono">{a.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-zinc-100">{value}</p>
    </div>
  );
}
