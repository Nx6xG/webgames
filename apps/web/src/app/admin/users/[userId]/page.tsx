'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/components/providers/LanguageProvider';
import { fetchUser, patchUser } from '@/lib/adminApi';
import { ACHIEVEMENTS, CATEGORY_ORDER } from '@/lib/achievements/definitions';
import type { AchievementCategory } from '@/lib/achievements/definitions';
import { COSMETICS_REGISTRY, RARITY_COLORS, RARITY_BG, type CosmeticSlot } from '@/lib/cosmetics';

interface ProgressionData {
  xp: number;
  level: number;
  tokens: number;
  [key: string]: unknown;
}

interface UserDetail {
  profile: { id: string; nickname: string | null; role: string; created_at: string; suspended_at: string | null };
  email: string | null;
  stats: { plays_total: number; wins_total: number; invites_total: number; plays_by_game: Record<string, number>; wins_by_game: Record<string, number> } | null;
  achievements: { unlocked: string[] } | null;
  cosmetics: { data: Record<string, unknown> } | null;
  unlockedCosmetics: { data: Record<string, string[]> } | null;
  progression: ProgressionData | null;
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
        <StatsManager
          stats={stats}
          actionLoading={actionLoading}
          confirm={confirm}
          t={t}
          onResetAll={() => doAction({ action: 'reset_stats' }, 'reset_stats_all')}
          onResetGame={(gameId) => doAction({ action: 'reset_stats_game', gameId }, `reset_stats_${gameId}`)}
          onCancelConfirm={() => setConfirm(null)}
        />
      </Section>

      {/* Progression */}
      <Section title={t('admin.progression.title')}>
        <ProgressionManager
          progression={user.progression}
          actionLoading={actionLoading}
          t={t}
          onAddXp={(amount) => quickAction({ action: 'add_xp', amount }, `add_xp_${amount}`)}
          onSetTokens={(tokens) => quickAction({ action: 'set_tokens', tokens }, `set_tokens_${tokens}`)}
        />
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
          onBulkGrant={(ids) => doAction({ action: 'bulk_grant_achievements', achievementIds: ids }, `bulk_grant_ach_${ids.length}`)}
          onBulkRevoke={(ids) => doAction({ action: 'bulk_revoke_achievements', achievementIds: ids }, `bulk_revoke_ach_${ids.length}`)}
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
          onBulkGrant={(items) => doAction({ action: 'bulk_grant_cosmetics', cosmetics: items }, `bulk_grant_cos_${items.length}`)}
          onBulkRevoke={(items) => doAction({ action: 'bulk_revoke_cosmetics', cosmetics: items }, `bulk_revoke_cos_${items.length}`)}
        />
      </Section>

      {/* Account Actions */}
      <Section title={t('admin.users.actions')}>
        <div className="flex flex-wrap gap-2">
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
  unlockedSet, actionLoading, t, onGrant, onRevoke, onBulkGrant, onBulkRevoke,
}: {
  unlockedSet: Set<string>;
  actionLoading: string | null;
  t: (key: string) => string;
  onGrant: (id: string) => void;
  onRevoke: (id: string) => void;
  onBulkGrant: (ids: string[]) => void;
  onBulkRevoke: (ids: string[]) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [search, setSearch] = useState('');
  const [bulkCategory, setBulkCategory] = useState<AchievementCategory | 'all'>('all');

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
        const au = unlockedSet.has(a.id) ? 0 : 1;
        const bu = unlockedSet.has(b.id) ? 0 : 1;
        return au - bu;
      });
  }, [filter, search, unlockedSet, t]);

  const bulkIds = useMemo(() => {
    if (bulkCategory === 'all') return ACHIEVEMENTS.map((a) => a.id);
    return ACHIEVEMENTS.filter((a) => a.tags?.[0] === bulkCategory).map((a) => a.id);
  }, [bulkCategory]);

  const bulkLocked = bulkIds.filter((id) => !unlockedSet.has(id));
  const bulkUnlocked = bulkIds.filter((id) => unlockedSet.has(id));

  return (
    <div className="space-y-3">
      {/* Bulk actions */}
      <div className="rounded-lg bg-zinc-800/30 border border-zinc-700/40 p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value as AchievementCategory | 'all')}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 outline-none focus:border-indigo-500"
          >
            <option value="all">{t('admin.achievements.filter.all')} ({ACHIEVEMENTS.length})</option>
            {CATEGORY_ORDER.map((cat) => {
              const count = ACHIEVEMENTS.filter((a) => a.tags?.[0] === cat).length;
              return (
                <option key={cat} value={cat}>
                  {t(`achievements.category.${cat}`)} ({count})
                </option>
              );
            })}
          </select>
          <button
            onClick={() => onBulkGrant(bulkLocked.length > 0 ? bulkLocked : bulkIds)}
            disabled={actionLoading?.startsWith('bulk_grant_ach') || bulkLocked.length === 0}
            className="px-2.5 py-1 rounded-md text-[10px] font-semibold border border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/30 transition-colors disabled:opacity-40"
          >
            {t('admin.achievements.grantAll')} ({bulkLocked.length})
          </button>
          <button
            onClick={() => onBulkRevoke(bulkUnlocked)}
            disabled={actionLoading?.startsWith('bulk_revoke_ach') || bulkUnlocked.length === 0}
            className="px-2.5 py-1 rounded-md text-[10px] font-semibold border border-rose-800/60 text-rose-400 hover:bg-rose-900/30 transition-colors disabled:opacity-40"
          >
            {t('admin.achievements.revokeAll')} ({bulkUnlocked.length})
          </button>
        </div>
      </div>

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
  unlockedCosmetics, actionLoading, t, onGrant, onRevoke, onBulkGrant, onBulkRevoke,
}: {
  unlockedCosmetics: Record<string, string[]>;
  actionLoading: string | null;
  t: (key: string) => string;
  onGrant: (id: string, slot: string) => void;
  onRevoke: (id: string, slot: string) => void;
  onBulkGrant: (items: { slot: string; id: string }[]) => void;
  onBulkRevoke: (items: { slot: string; id: string }[]) => void;
}) {
  const [activeSlot, setActiveSlot] = useState<CosmeticSlot>('frame');
  const [search, setSearch] = useState('');
  const [bulkSlot, setBulkSlot] = useState<CosmeticSlot | 'all'>('all');

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

  const bulkItems = useMemo(() => {
    if (bulkSlot === 'all') return COSMETICS_REGISTRY.map((c) => ({ slot: c.slot, id: c.id }));
    return COSMETICS_REGISTRY.filter((c) => c.slot === bulkSlot).map((c) => ({ slot: c.slot, id: c.id }));
  }, [bulkSlot]);

  const bulkLocked = bulkItems.filter((c) => !(unlockedCosmetics[c.slot] ?? []).includes(c.id));
  const bulkUnlockedItems = bulkItems.filter((c) => (unlockedCosmetics[c.slot] ?? []).includes(c.id));

  return (
    <div className="space-y-3">
      {/* Bulk actions */}
      <div className="rounded-lg bg-zinc-800/30 border border-zinc-700/40 p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={bulkSlot}
            onChange={(e) => setBulkSlot(e.target.value as CosmeticSlot | 'all')}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 outline-none focus:border-indigo-500"
          >
            <option value="all">{t('admin.achievements.filter.all')} ({COSMETICS_REGISTRY.length})</option>
            {SLOT_ORDER.map((s) => {
              const count = COSMETICS_REGISTRY.filter((c) => c.slot === s).length;
              return (
                <option key={s} value={s}>
                  {t(`admin.cosmetics.slot.${s}`)} ({count})
                </option>
              );
            })}
          </select>
          <button
            onClick={() => onBulkGrant(bulkLocked.length > 0 ? bulkLocked : bulkItems)}
            disabled={actionLoading?.startsWith('bulk_grant_cos') || bulkLocked.length === 0}
            className="px-2.5 py-1 rounded-md text-[10px] font-semibold border border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/30 transition-colors disabled:opacity-40"
          >
            {t('admin.cosmetics.grantAll')} ({bulkLocked.length})
          </button>
          <button
            onClick={() => onBulkRevoke(bulkUnlockedItems)}
            disabled={actionLoading?.startsWith('bulk_revoke_cos') || bulkUnlockedItems.length === 0}
            className="px-2.5 py-1 rounded-md text-[10px] font-semibold border border-rose-800/60 text-rose-400 hover:bg-rose-900/30 transition-colors disabled:opacity-40"
          >
            {t('admin.cosmetics.revokeAll')} ({bulkUnlockedItems.length})
          </button>
        </div>
      </div>

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

// ── Progression Manager ──────────────────────────────────────────────────────

function ProgressionManager({
  progression, actionLoading, t, onAddXp, onSetTokens,
}: {
  progression: ProgressionData | null;
  actionLoading: string | null;
  t: (key: string) => string;
  onAddXp: (amount: number) => void;
  onSetTokens: (tokens: number) => void;
}) {
  const [customXp, setCustomXp] = useState('');
  const [customTokens, setCustomTokens] = useState('');
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [feedback, setFeedback] = useState<string | null>(null);

  const prog = progression ?? { xp: 0, level: 1, tokens: 0 };
  const required = Math.floor(100 * Math.pow(prog.level, 1.45));

  // Rank calculation (mirrors rank.ts)
  const rankKey = prog.level >= 35 ? 'legend' : prog.level >= 20 ? 'master' : prog.level >= 10 ? 'challenger' : prog.level >= 5 ? 'player' : 'rookie';

  const XP_PRESETS = [50, 100, 250, 500];

  function showFeedback(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  }

  function handlePresetXp(amount: number) {
    const actual = mode === 'add' ? amount : -amount;
    onAddXp(actual);
    showFeedback(`${actual > 0 ? '+' : ''}${actual} XP`);
  }

  function handleCustomXp() {
    const val = parseInt(customXp, 10);
    if (!val || val <= 0) return;
    const actual = mode === 'add' ? val : -val;
    onAddXp(actual);
    showFeedback(`${actual > 0 ? '+' : ''}${actual} XP`);
    setCustomXp('');
  }

  function handleSetTokens() {
    const val = parseInt(customTokens, 10);
    if (isNaN(val) || val < 0) return;
    onSetTokens(val);
    showFeedback(`Tokens → ${val}`);
    setCustomTokens('');
  }

  return (
    <div className="space-y-3">
      {/* Current stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="rounded-md bg-indigo-950/30 border border-indigo-500/15 px-2.5 py-2">
          <p className="text-[10px] text-zinc-500 mb-0.5">{t('admin.progression.currentLevel')}</p>
          <p className="text-indigo-300 font-bold text-base tabular-nums">Lv. {prog.level}</p>
        </div>
        <div className="rounded-md bg-zinc-800/30 border border-zinc-700/30 px-2.5 py-2">
          <p className="text-[10px] text-zinc-500 mb-0.5">{t('progression.rank')}</p>
          <p className="text-indigo-400 font-semibold">{t(`progression.rank.${rankKey}`)}</p>
        </div>
        <div className="rounded-md bg-zinc-800/30 border border-zinc-700/30 px-2.5 py-2">
          <p className="text-[10px] text-zinc-500 mb-0.5">{t('admin.progression.currentXp')}</p>
          <p className="text-zinc-200 tabular-nums font-medium">{prog.xp} <span className="text-zinc-600">/ {required}</span></p>
        </div>
        <div className="rounded-md bg-amber-950/20 border border-amber-500/15 px-2.5 py-2">
          <p className="text-[10px] text-zinc-500 mb-0.5">{t('admin.progression.tokens')}</p>
          <p className="text-amber-400 font-bold text-base tabular-nums">{prog.tokens}</p>
        </div>
      </div>

      {/* XP progress bar */}
      <div>
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all"
            style={{ width: `${required > 0 ? Math.max(2, (prog.xp / required) * 100) : 0}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-zinc-600 tabular-nums">{required > 0 ? Math.round((prog.xp / required) * 100) : 0}%</span>
          <span className="text-[10px] text-zinc-600 tabular-nums">{required - prog.xp} XP to Lv. {prog.level + 1}</span>
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className="px-3 py-1.5 rounded-md bg-indigo-900/40 border border-indigo-500/30 text-indigo-300 text-xs font-medium text-center">
          {feedback}
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5 bg-zinc-800/50 rounded-md p-0.5">
          <button
            onClick={() => setMode('add')}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
              mode === 'add' ? 'bg-emerald-900/50 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >{t('admin.progression.addXp')}</button>
          <button
            onClick={() => setMode('remove')}
            className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
              mode === 'remove' ? 'bg-rose-900/50 text-rose-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >{t('admin.progression.removeXp')}</button>
        </div>
      </div>

      {/* XP presets */}
      <div className="flex flex-wrap gap-1.5">
        {XP_PRESETS.map((amount) => {
          const actual = mode === 'add' ? amount : -amount;
          const key = `add_xp_${actual}`;
          return (
            <button
              key={amount}
              onClick={() => handlePresetXp(amount)}
              disabled={actionLoading === key}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium border transition-colors disabled:opacity-40 ${
                mode === 'add'
                  ? 'border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/30'
                  : 'border-rose-800/60 text-rose-400 hover:bg-rose-900/30'
              }`}
            >
              {mode === 'add' ? '+' : '-'}{amount} XP
            </button>
          );
        })}
      </div>

      {/* Custom XP input */}
      <div className="flex gap-1.5">
        <input
          type="number"
          value={customXp}
          onChange={(e) => setCustomXp(e.target.value)}
          placeholder={t('admin.progression.customXp')}
          min="1"
          className="flex-1 min-w-[80px] bg-zinc-800/50 border border-zinc-700/50 rounded-md px-2.5 py-1.5 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50"
          onKeyDown={(e) => { if (e.key === 'Enter') handleCustomXp(); }}
        />
        <button
          onClick={handleCustomXp}
          className={`px-3 py-1.5 rounded-md text-[11px] font-medium border transition-colors ${
            mode === 'add'
              ? 'border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/30'
              : 'border-rose-800/60 text-rose-400 hover:bg-rose-900/30'
          }`}
        >
          {t('admin.progression.apply')}
        </button>
      </div>

      {/* Token management */}
      <div className="pt-2 border-t border-zinc-800">
        <div className="flex gap-1.5 items-center">
          <span className="text-[10px] text-zinc-500 font-medium shrink-0">{t('admin.progression.tokens')}:</span>
          <input
            type="number"
            value={customTokens}
            onChange={(e) => setCustomTokens(e.target.value)}
            placeholder={String(prog.tokens)}
            min="0"
            className="w-20 bg-zinc-800/50 border border-zinc-700/50 rounded-md px-2.5 py-1 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSetTokens(); }}
          />
          <button
            onClick={handleSetTokens}
            className="px-2.5 py-1 rounded-md text-[10px] font-medium border border-amber-800/60 text-amber-400 hover:bg-amber-900/30 transition-colors"
          >
            {t('admin.progression.apply')}
          </button>
        </div>
      </div>

      {!progression && (
        <p className="text-[10px] text-zinc-600 italic">{t('admin.progression.noData')}</p>
      )}
    </div>
  );
}

// ── Stats Manager ────────────────────────────────────────────────────────────

const GAME_LABELS: Record<string, string> = {
  tictactoe: 'Tic-Tac-Toe',
  connect4: 'Connect 4',
  rps: 'Rock Paper Scissors',
  chess: 'Chess',
  battleship: 'Battleship',
  liarsbar: "Liar's Deck",
  curvefever: 'Curve Fever',
  uno: 'UNO',
};

function StatsManager({ stats, actionLoading, confirm, t, onResetAll, onResetGame, onCancelConfirm }: {
  stats: UserDetail['stats'];
  actionLoading: string | null;
  confirm: string | null;
  t: (key: string) => string;
  onResetAll: () => void;
  onResetGame: (gameId: string) => void;
  onCancelConfirm: () => void;
}) {
  if (!stats) return <p className="text-xs text-zinc-600">{t('admin.users.noStats')}</p>;

  const playsByGame = stats.plays_by_game ?? {};
  const winsByGame = stats.wins_by_game ?? {};
  const gameIds = [...new Set([...Object.keys(playsByGame), ...Object.keys(winsByGame)])].sort();

  return (
    <div className="space-y-4">
      {/* Totals */}
      <div className="grid grid-cols-4 gap-3 text-xs">
        <div className="bg-zinc-800/50 rounded-md px-3 py-2">
          <div className="text-zinc-500 text-[10px] uppercase tracking-wider">{t('admin.users.plays')}</div>
          <div className="text-zinc-100 font-semibold text-sm">{stats.plays_total}</div>
        </div>
        <div className="bg-zinc-800/50 rounded-md px-3 py-2">
          <div className="text-zinc-500 text-[10px] uppercase tracking-wider">{t('admin.users.wins')}</div>
          <div className="text-zinc-100 font-semibold text-sm">{stats.wins_total}</div>
        </div>
        <div className="bg-zinc-800/50 rounded-md px-3 py-2">
          <div className="text-zinc-500 text-[10px] uppercase tracking-wider">Winrate</div>
          <div className="text-zinc-100 font-semibold text-sm">
            {stats.plays_total > 0 ? `${Math.round((stats.wins_total / stats.plays_total) * 100)}%` : '—'}
          </div>
        </div>
        <div className="bg-zinc-800/50 rounded-md px-3 py-2">
          <div className="text-zinc-500 text-[10px] uppercase tracking-wider">{t('admin.users.invites')}</div>
          <div className="text-zinc-100 font-semibold text-sm">{stats.invites_total}</div>
        </div>
      </div>

      {/* Per-game breakdown */}
      {gameIds.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Per Game</div>
          <div className="border border-zinc-800 rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-zinc-800/50 text-zinc-500">
                  <th className="text-left px-3 py-1.5 font-medium">Spiel</th>
                  <th className="text-right px-3 py-1.5 font-medium">{t('admin.users.plays')}</th>
                  <th className="text-right px-3 py-1.5 font-medium">{t('admin.users.wins')}</th>
                  <th className="text-right px-3 py-1.5 font-medium">Niederlagen</th>
                  <th className="text-right px-3 py-1.5 font-medium">Winrate</th>
                  <th className="text-right px-3 py-1.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {gameIds.map((gid) => {
                  const plays = playsByGame[gid] ?? 0;
                  const wins = winsByGame[gid] ?? 0;
                  const losses = plays - wins;
                  const wr = plays > 0 ? Math.round((wins / plays) * 100) : 0;
                  const key = `reset_stats_${gid}`;
                  const isConfirming = confirm === key;
                  const isLoading = actionLoading === key;
                  return (
                    <tr key={gid} className="border-t border-zinc-800/60 hover:bg-zinc-800/20">
                      <td className="px-3 py-1.5 text-zinc-200 font-medium">{GAME_LABELS[gid] ?? gid}</td>
                      <td className="px-3 py-1.5 text-right text-zinc-300 tabular-nums">{plays}</td>
                      <td className="px-3 py-1.5 text-right text-emerald-400 tabular-nums">{wins}</td>
                      <td className="px-3 py-1.5 text-right text-rose-400 tabular-nums">{losses}</td>
                      <td className="px-3 py-1.5 text-right text-zinc-400 tabular-nums">{wr}%</td>
                      <td className="px-3 py-1.5 text-right">
                        {isConfirming ? (
                          <span className="inline-flex gap-1">
                            <button onClick={() => onResetGame(gid)} disabled={isLoading}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50 transition-colors">
                              Reset?
                            </button>
                            <button onClick={onCancelConfirm}
                              className="px-1.5 py-0.5 rounded text-[10px] border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors">
                              ✕
                            </button>
                          </span>
                        ) : (
                          <button onClick={() => onResetGame(gid)} disabled={isLoading}
                            className="px-2 py-0.5 rounded text-[10px] border border-rose-800/60 text-rose-400/70 hover:text-rose-300 hover:border-rose-700 disabled:opacity-50 transition-colors">
                            Reset
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reset all button */}
      <div className="flex items-center gap-2 pt-1">
        <ActionButton
          label={t('admin.actions.resetStats')} variant="danger"
          loading={actionLoading === 'reset_stats_all'} confirming={confirm === 'reset_stats_all'}
          onClick={onResetAll}
          onCancel={onCancelConfirm}
        />
        <span className="text-[10px] text-zinc-600">Setzt alle Spiele, Siege und Einladungen auf 0</span>
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
