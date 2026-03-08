'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { fetchUsers } from '@/lib/adminApi';

interface UserRow {
  id: string;
  nickname: string | null;
  email: string | null;
  role: string;
  created_at: string;
  suspended_at: string | null;
  plays_total: number;
  wins_total: number;
}

export default function AdminUsersPage() {
  const { t } = useI18n();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchUsers(search, page, limit);
      setUsers(res.users);
      setTotal(res.total);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{t('admin.nav.users')}</h1>

      {/* Search */}
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('admin.users.searchPlaceholder')}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Table */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-zinc-900 text-zinc-500 text-left">
              <th className="px-3 py-2 font-medium">{t('admin.users.nickname')}</th>
              <th className="px-3 py-2 font-medium">{t('admin.users.email')}</th>
              <th className="px-3 py-2 font-medium">{t('admin.users.role')}</th>
              <th className="px-3 py-2 font-medium">{t('admin.users.stats')}</th>
              <th className="px-3 py-2 font-medium">{t('admin.users.status')}</th>
              <th className="px-3 py-2 font-medium">{t('admin.users.created')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-zinc-600">{t('admin.loading')}</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-zinc-600">{t('admin.users.noResults')}</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t border-zinc-800 hover:bg-zinc-900/50 transition-colors">
                  <td className="px-3 py-2">
                    <Link href={`/admin/users/${u.id}`} className="text-indigo-400 hover:text-indigo-300 transition-colors">
                      {u.nickname || '—'}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{u.email || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      u.role === 'admin' ? 'bg-red-900/40 text-red-400' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{u.plays_total}P / {u.wins_total}W</td>
                  <td className="px-3 py-2">
                    {u.suspended_at ? (
                      <span className="text-rose-400 text-[10px] font-semibold">{t('admin.users.suspended')}</span>
                    ) : (
                      <span className="text-emerald-400 text-[10px] font-semibold">{t('admin.users.active')}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{total} {t('admin.users.total')}</span>
        <div className="flex gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800 disabled:opacity-30 transition-colors"
          >
            &larr;
          </button>
          <span className="px-2 py-1">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800 disabled:opacity-30 transition-colors"
          >
            &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
