'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { fetchUser, patchUser } from '@/lib/adminApi';
import { ACHIEVEMENTS } from '@/lib/achievements/definitions';
import { COSMETICS_REGISTRY, RARITY_COLORS, RARITY_BG, type CosmeticSlot } from '@/lib/cosmetics';

interface UserDetail {
  profile: { id: string; nickname: string | null; role: string; created_at: string; suspended_at: string | null };
  email: string | null;
  stats: { plays_total: number; wins_total: number; invites_total: number; plays_by_game: Record<string, number>; wins_by_game: Record<string, number> } | null;
  achievements: { unlocked: string[] } | null;
  cosmetics: { data: Record<string, unknown> } | null;
  unlockedCosmetics: { data: Record<string, string[]> } | null;
}

const SLOT_ORDER: CosmeticSlot[] = ['frame', 'head', 'portal', 'aura', 'banner', 'cardColor', 'badge', 'title'];

const SLOT_EMOJI: Record<CosmeticSlot, string> = {
  frame: '🖼', head: '🎩', portal: '🌀', aura: '✨', banner: '🏳', cardColor: '🎨', badge: '🏅', title: '🏷',
};

export default function AdminUserDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUser(await fetchUser(userId));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function doAction(body: Record<string, unknown>, confirmKey: string) {
    if (confirm !== confirmKey) { setConfirm(confirmKey); return; }
    setActionLoading(confirmKey);
    setConfirm(null);
    try {
      await patchUser(userId, body);
      setMessage(t('admin.actionSuccess'));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActionLoading(null);
      setTimeout(() => setMessage(null), 3000);
    }
  }

  async function quickAction(body: Record<string, unknown>, key: string) {
    setActionLoading(key);
    try {
      await patchUser(userId, body);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed');
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return <p className="text-zinc-500 text-sm">{t('admin.loading')}</p>;
  if (!user) return <p className="text-rose-400 text-sm">{t('admin.users.notFound')}</p>;

  const { profile, stats } = user;
  const unlockedSet = new Set(user.achievements?.unlocked ?? []);
  const unlockedCosmetics = user.unlockedCosmetics?.data ?? {};
  const totalUnlockedCosmetics = Object.values(unlockedCosmetics).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <button onClick={() => router.push('/admin/users')} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
        &larr; {t('admin.users.backToList')}
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold truncate">{profile.nickname || '—'}</h1>
          <p className="text-xs text-zinc-500 truncate">{user.email || profile.id}</p>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
          profile.role === 'admin' ? 'bg-red-900/40 text-red-400' : 'bg-zinc-800 text-zinc-400'
        }`}>{profile.role}</span>
        {profile.suspended_at && (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-900/40 text-rose-400 shrink-0">
            {t('admin.users.suspended')}
          </span>
        )}
      </div>

      {message && (
        <div className="px-3 py-2 rounded-md bg-emerald-900/30 border border-emerald-800 text-emerald-300 text-xs">
          {message}
        </div>
      )}

      {/* Stats */}
      <Section title={t('admin.users.stats')}>
        {stats ? (
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div><span className="text-zinc-500">{t('admin.users.plays')}: </span><span className="text-zinc-200">{stats.plays_total}</span></div>
            <div><span className="text-zinc-500">{t('admin.users.wins')}: </span><span className="text-zinc-200">{stats.wins_total}</span></div>
            <div><span className="text-zinc-500">{t('admin.users.invites')}: </span><span className="text-zinc-200">{stats.invites_total}</span></div>
          </div>
        ) : (
          <p className="text-xs text-zinc-600">{t('admin.users.noStats')}</p>
        )}
      </Section>

      {/* Achievements */}
      <Section
        title={t('admin.achievements.title')}
        badge={`${unlockedSet.size} / ${ACHIEVEMENTS.length}`}
      >
        <AchievementManager
          unlockedSet={unlockedSet}
          actionLoading={actionLoading}
          t={t}
          onGrant={(id) => quickAction({ action: 'grant_achievement', achievementId: id }, `grant_ach_${id}`)}
          onRevoke={(id) => quickAction({ action: 'revoke_achievement', achievementId: id }, `revoke_ach_${id}`)}
        />
      </Section>

      {/* Cosmetics */}
      <Section
        title={t('admin.cosmetics.title')}
        badge={`${totalUnlockedCosmetics} / ${COSMETICS_REGISTRY.length}`}
      >
        <CosmeticsManager
          unlockedCosmetics={unlockedCosmetics}
          actionLoading={actionLoading}
          t={t}
          onGrant={(id, slot) => quickAction({ action: 'grant_cosmetic', cosmeticId: id, slot }, `grant_cos_${slot}_${id}`)}
          onRevoke={(id, slot) => quickAction({ action: 'revoke_cosmetic', cosmeticId: id, slot }, `revoke_cos_${slot}_${id}`)}
        />
      </Section>

      {/* Account Actions */}
      <Section title={t('admin.users.actions')}>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            label={t('admin.actions.resetStats')} variant="danger"
            loading={actionLoading === 'reset_stats'} confirming={confirm === 'reset_stats'}
            onClick={() => doAction({ action: 'reset_stats' }, 'reset_stats')}
            onCancel={() => setConfirm(null)}
          />
          {profile.suspended_at ? (
            <ActionButton
              label={t('admin.actions.unsuspend')} variant="success"
              loading={actionLoading === 'unsuspend'} confirming={confirm === 'unsuspend'}
              onClick={() => doAction({ action: 'unsuspend' }, 'unsuspend')}
              onCancel={() => setConfirm(null)}
            />
          ) : (
            <ActionButton
              label={t('admin.actions.suspend')} variant="danger"
              loading={actionLoading === 'suspend'} confirming={confirm === 'suspend'}
              onClick={() => doAction({ action: 'suspend' }, 'suspend')}
              onCancel={() => setConfirm(null)}
            />
          )}
          {profile.role === 'admin' ? (
            <ActionButton
              label={t('admin.actions.removeAdmin')} variant="danger"
              loading={actionLoading === 'set_role_user'} confirming={confirm === 'set_role_user'}
              onClick={() => doAction({ action: 'set_role', role: 'user' }, 'set_role_user')}
              onCancel={() => setConfirm(null)}
            />
          ) : (
            <ActionButton
              label={t('admin.actions.makeAdmin')} variant="warning"
              loading={actionLoading === 'set_role_admin'} confirming={confirm === 'set_role_admin'}
              onClick={() => doAction({ action: 'set_role', role: 'admin' }, 'set_role_admin')}
              onCancel={() => setConfirm(null)}
            />
          )}
        </div>
      </Section>

      {/* Info */}
      <Section title={t('admin.users.info')}>
        <div className="text-xs space-y-1 text-zinc-500">
          <p>ID: <span className="font-mono text-zinc-400 select-all">{profile.id}</span></p>
          <p>{t('admin.users.created')}: {new Date(profile.created_at).toLocaleString()}</p>
          {profile.suspended_at && (
            <p>{t('admin.users.suspendedAt')}: {new Date(profile.suspended_at).toLocaleString()}</p>
          )}
        </div>
      </Section>
    </div>
  );
}

// ── Achievement Manager ──────────────────────────────────────────────────────

function AchievementManager({
  unlockedSet, actionLoading, t, onGrant, onRevoke,
}: {
  unlockedSet: Set<string>;
  actionLoading: string | null;
  t: (key: string) => string;
  onGrant: (id: string) => void;
  onRevoke: (id: string) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return ACHIEVEMENTS
      .filter((a) => {
        if (filter === 'unlocked' && !unlockedSet.has(a.id)) return false;
        if (filter === 'locked' && unlockedSet.has(a.id)) return false;
        if (q) {
          const name = t(a.nameKey).toLowerCase();
          return a.id.toLowerCase().includes(q) || name.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        // unlocked first
        const au = unlockedSet.has(a.id) ? 0 : 1;
        const bu = unlockedSet.has(b.id) ? 0 : 1;
        return au - bu;
      });
  }, [filter, search, unlockedSet, t]);

  return (
    <div className="space-y-2">
      {/* Controls row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-0.5 bg-zinc-800/50 rounded-md p-0.5">
          {(['all', 'unlocked', 'locked'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                filter === f ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >{t(`admin.achievements.filter.${f}`)}</button>
          ))}
        </div>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.search')}
          className="flex-1 min-w-[120px] bg-zinc-800/50 border border-zinc-700/50 rounded-md px-2 py-0.5 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50"
        />
        <span className="text-[10px] text-zinc-600 shrink-0 tabular-nums">{filtered.length} {t('admin.results')}</span>
      </div>

      {/* List */}
      <div className="space-y-0.5 max-h-[320px] overflow-y-auto pr-0.5">
        {filtered.length === 0 ? (
          <p className="text-[11px] text-zinc-600 py-4 text-center">{t('admin.noResults')}</p>
        ) : filtered.map((a) => {
          const unlocked = unlockedSet.has(a.id);
          const key = unlocked ? `revoke_ach_${a.id}` : `grant_ach_${a.id}`;
          const busy = actionLoading === key;
          return (
            <div key={a.id}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors ${
                unlocked ? 'bg-emerald-950/20 border border-emerald-900/30' : 'bg-zinc-900/50 border border-zinc-800/50'
              }`}
            >
              <span className="text-base shrink-0 w-5 text-center leading-none">{a.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-zinc-200 truncate">{t(a.nameKey)}</p>
                <p className="text-[9px] text-zinc-500 font-mono truncate">{a.id}</p>
              </div>
              {unlocked && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-900/40 text-[9px] text-emerald-400 font-semibold shrink-0">
                  {t('admin.achievements.unlocked')}
                </span>
              )}
              <button onClick={() => unlocked ? onRevoke(a.id) : onGrant(a.id)} disabled={busy}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border shrink-0 transition-colors disabled:opacity-40 ${
                  unlocked
                    ? 'border-rose-800/60 text-rose-400 hover:bg-rose-900/30'
                    : 'border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/30'
                }`}
              >{unlocked ? t('admin.achievements.revoke') : t('admin.achievements.grant')}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Cosmetics Manager ────────────────────────────────────────────────────────

function CosmeticsManager({
  unlockedCosmetics, actionLoading, t, onGrant, onRevoke,
}: {
  unlockedCosmetics: Record<string, string[]>;
  actionLoading: string | null;
  t: (key: string) => string;
  onGrant: (id: string, slot: string) => void;
  onRevoke: (id: string, slot: string) => void;
}) {
  const [activeSlot, setActiveSlot] = useState<CosmeticSlot>('frame');
  const [search, setSearch] = useState('');

  const items = useMemo(() => {
    const slotUnlocked = new Set(unlockedCosmetics[activeSlot] ?? []);
    const q = search.toLowerCase().trim();
    return COSMETICS_REGISTRY
      .filter((c) => c.slot === activeSlot)
      .filter((c) => !q || c.id.toLowerCase().includes(q) || t(c.labelKey).toLowerCase().includes(q) || c.rarity.includes(q))
      .sort((a, b) => {
        const au = slotUnlocked.has(a.id) ? 0 : 1;
        const bu = slotUnlocked.has(b.id) ? 0 : 1;
        return au - bu;
      });
  }, [activeSlot, search, unlockedCosmetics, t]);

  const slotUnlocked = new Set(unlockedCosmetics[activeSlot] ?? []);

  return (
    <div className="space-y-2">
      {/* Slot tabs */}
      <div className="flex gap-0.5 flex-wrap bg-zinc-800/30 rounded-md p-0.5">
        {SLOT_ORDER.map((slot) => {
          const count = (unlockedCosmetics[slot] ?? []).length;
          const total = COSMETICS_REGISTRY.filter((c) => c.slot === slot).length;
          const active = activeSlot === slot;
          return (
            <button key={slot} onClick={() => { setActiveSlot(slot); setSearch(''); }}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors flex items-center gap-1 ${
                active ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span className="text-xs leading-none">{SLOT_EMOJI[slot]}</span>
              <span className="hidden sm:inline">{t(`admin.cosmetics.slot.${slot}`)}</span>
              <span className={`tabular-nums ${active ? 'text-zinc-400' : 'text-zinc-600'}`}>{count}/{total}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder={t('admin.search')}
        className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-md px-2 py-0.5 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50"
      />

      {/* Items */}
      <div className="space-y-0.5 max-h-[280px] overflow-y-auto pr-0.5">
        {items.length === 0 ? (
          <p className="text-[11px] text-zinc-600 py-4 text-center">{t('admin.noResults')}</p>
        ) : items.map((c) => {
          const unlocked = slotUnlocked.has(c.id);
          const key = unlocked ? `revoke_cos_${c.slot}_${c.id}` : `grant_cos_${c.slot}_${c.id}`;
          const busy = actionLoading === key;
          return (
            <div key={c.id}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors ${
                unlocked ? 'bg-emerald-950/20 border border-emerald-900/30' : 'bg-zinc-900/50 border border-zinc-800/50'
              }`}
            >
              <span className="text-base shrink-0 w-5 text-center leading-none">{c.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-zinc-200 truncate">{t(c.labelKey)}</p>
                <p className="text-[9px] text-zinc-500 font-mono truncate">{c.id}</p>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 ${RARITY_BG[c.rarity]} ${RARITY_COLORS[c.rarity]}`}>
                {c.rarity}
              </span>
              {unlocked && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-900/40 text-[9px] text-emerald-400 font-semibold shrink-0">
                  {t('admin.cosmetics.unlocked')}
                </span>
              )}
              <button onClick={() => unlocked ? onRevoke(c.id, c.slot) : onGrant(c.id, c.slot)} disabled={busy}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border shrink-0 transition-colors disabled:opacity-40 ${
                  unlocked
                    ? 'border-rose-800/60 text-rose-400 hover:bg-rose-900/30'
                    : 'border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/30'
                }`}
              >{unlocked ? t('admin.cosmetics.revoke') : t('admin.cosmetics.grant')}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Shared components ────────────────────────────────────────────────────────

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-xs font-semibold text-zinc-400">{title}</h2>
        {badge && (
          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-500 font-mono tabular-nums">{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function ActionButton({ label, variant, loading, confirming, onClick, onCancel }: {
  label: string; variant: 'danger' | 'warning' | 'success';
  loading: boolean; confirming: boolean; onClick: () => void; onCancel: () => void;
}) {
  const colors = {
    danger: 'border-rose-800 text-rose-400 hover:bg-rose-900/30',
    warning: 'border-amber-800 text-amber-400 hover:bg-amber-900/30',
    success: 'border-emerald-800 text-emerald-400 hover:bg-emerald-900/30',
  };
  const confirmColors = {
    danger: 'bg-rose-600 text-white hover:bg-rose-500 border-rose-600',
    warning: 'bg-amber-600 text-white hover:bg-amber-500 border-amber-600',
    success: 'bg-emerald-600 text-white hover:bg-emerald-500 border-emerald-600',
  };

  if (confirming) {
    return (
      <div className="flex gap-1">
        <button onClick={onClick} disabled={loading}
          className={`px-3 py-1 rounded-md text-[11px] font-semibold border transition-colors disabled:opacity-50 ${confirmColors[variant]}`}
        >{label}?</button>
        <button onClick={onCancel}
          className="px-2 py-1 rounded-md text-[11px] border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
        >✕</button>
      </div>
    );
  }

  return (
    <button onClick={onClick} disabled={loading}
      className={`px-3 py-1 rounded-md text-[11px] font-medium border transition-colors disabled:opacity-50 ${colors[variant]}`}
    >{label}</button>
  );
}
