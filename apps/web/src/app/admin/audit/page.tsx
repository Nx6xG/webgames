'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { fetchAuditLog } from '@/lib/adminApi';

interface AuditEntry {
  id: number;
  admin_id: string;
  admin_nickname: string;
  action: string;
  target_user_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export default function AdminAuditPage() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAuditLog(page, limit);
      setEntries(res.entries);
      setTotal(res.total);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">{t('admin.nav.audit')}</h1>

      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-zinc-900 text-zinc-500 text-left">
              <th className="px-3 py-2 font-medium">{t('admin.audit.time')}</th>
              <th className="px-3 py-2 font-medium">{t('admin.audit.admin')}</th>
              <th className="px-3 py-2 font-medium">{t('admin.audit.action')}</th>
              <th className="px-3 py-2 font-medium">{t('admin.audit.target')}</th>
              <th className="px-3 py-2 font-medium">{t('admin.audit.details')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-zinc-600">{t('admin.loading')}</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-zinc-600">{t('admin.noActivity')}</td></tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="border-t border-zinc-800 hover:bg-zinc-900/50 transition-colors">
                  <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 text-zinc-300">{e.admin_nickname}</td>
                  <td className="px-3 py-2 font-mono text-zinc-100">{e.action}</td>
                  <td className="px-3 py-2 text-zinc-500 font-mono text-[10px]">{e.target_user_id ? e.target_user_id.slice(0, 8) + '…' : '—'}</td>
                  <td className="px-3 py-2 text-zinc-600 font-mono text-[10px] max-w-[200px] truncate">
                    {e.details ? JSON.stringify(e.details) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{total} {t('admin.audit.total')}</span>
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
