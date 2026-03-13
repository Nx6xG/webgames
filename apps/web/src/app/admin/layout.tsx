'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useI18n } from '@/components/providers/LanguageProvider';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, session, isLoading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user || !session) {
      setError('Not authenticated — no user/session found. Please log in first.');
      setChecking(false);
      return;
    }

    // Check admin role via API
    fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).then(async (res) => {
      if (res.status === 403) {
        let detail = '';
        try { const body = await res.json(); detail = body.error ?? ''; } catch {}
        setError(`Access denied (403). ${detail}`);
        setChecking(false);
      } else if (!res.ok) {
        let detail = '';
        try { const body = await res.json(); detail = body.error ?? ''; } catch {}
        setError(`API error ${res.status}. ${detail}`);
        setChecking(false);
      } else {
        setRole('admin');
        setChecking(false);
      }
    }).catch((err) => {
      setError(`Network error: ${err.message}`);
      setChecking(false);
    });
  }, [user, session, isLoading, router]);

  if (isLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-zinc-500 text-sm">{t('admin.loading')}</div>
      </div>
    );
  }

  if (error || role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="max-w-md mx-auto text-center flex flex-col gap-4">
          <p className="text-red-400 text-sm font-semibold">Admin Panel Error</p>
          <p className="text-zinc-400 text-xs font-mono bg-zinc-900 rounded-lg p-4 text-left break-all">
            {error ?? 'Unknown error'}
          </p>
          <Link href="/" className="text-indigo-400 hover:text-indigo-300 text-xs underline">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: '/admin', label: t('admin.nav.dashboard') },
    { href: '/admin/users', label: t('admin.nav.users') },
    { href: '/admin/rooms', label: t('admin.nav.rooms') },
    { href: '/admin/audit', label: t('admin.nav.audit') },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center gap-6">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
            &larr; {t('admin.backToSite')}
          </Link>
          <span className="text-sm font-semibold text-red-400">{t('admin.title')}</span>
          <nav className="flex gap-1 ml-4">
            {navItems.map((item) => {
              const active = item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    active
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
