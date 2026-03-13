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

interface MahjongProgress {
  completed: string[];
  unlocked: string[];
}

interface CrossyProgress {
  wallet: number;
  owned: string[];
  activeSkin: string;
}

interface UserDetail {
  profile: { id: string; nickname: string | null; role: string; created_at: string; suspended_at: string | null };
  email: string | null;
  stats: { plays_total: number; wins_total: number; invites_total: number; plays_by_game: Record<string, number>; wins_by_game: Record<string, number> } | null;
  achievements: { unlocked: string[] } | null;
  cosmetics: { data: Record<string, unknown> } | null;
  unlockedCosmetics: { data: Record<string, string[]> } | null;
  progression: ProgressionData | null;
  gameProgress: Record<string, unknown> | null;
}

const SLOT_ORDER: CosmeticSlot[] = ['frame', 'head', 'portal', 'aura', 'banner', 'cardColor', 'badge', 'title'];

const SLOT_EMOJI: Record<CosmeticSlot, string> = {
  frame: '🖼', head: '🎩', portal: '🌀', aura: '✨', banner: '🏳', cardColor: '🎨', badge: '🏅', title: '🏷',
};

// ── Game progress constants ──────────────────────────────────────────────────

const MAHJONG_LAYOUTS: { id: string; difficulty: 'easy' | 'medium' | 'hard' }[] = [
  { id: 'flat', difficulty: 'easy' }, { id: 'arena', difficulty: 'easy' }, { id: 'garden', difficulty: 'easy' },
  { id: 'staircase', difficulty: 'easy' }, { id: 'turtle', difficulty: 'easy' }, { id: 'river', difficulty: 'easy' },
  { id: 'meadow', difficulty: 'easy' }, { id: 'columns', difficulty: 'easy' }, { id: 'valley', difficulty: 'easy' },
  { id: 'bricks', difficulty: 'easy' },
  { id: 'pyramid', difficulty: 'medium' }, { id: 'fortress', difficulty: 'medium' }, { id: 'bridge', difficulty: 'medium' },
  { id: 'temple', difficulty: 'medium' }, { id: 'waves', difficulty: 'medium' }, { id: 'hashtag', difficulty: 'medium' },
  { id: 'wings', difficulty: 'medium' }, { id: 'spiral', difficulty: 'medium' }, { id: 'crab', difficulty: 'medium' },
  { id: 'fan', difficulty: 'medium' },
  { id: 'cross', difficulty: 'hard' }, { id: 'spider', difficulty: 'hard' }, { id: 'diamond', difficulty: 'hard' },
  { id: 'pagoda', difficulty: 'hard' }, { id: 'dragon', difficulty: 'hard' }, { id: 'maze', difficulty: 'hard' },
  { id: 'phoenix', difficulty: 'hard' }, { id: 'tower', difficulty: 'hard' }, { id: 'volcano', difficulty: 'hard' },
  { id: 'labyrinth', difficulty: 'hard' },
];

const CROSSY_SKINS: { id: string; price: number }[] = [
  { id: 'chicken', price: 0 }, { id: 'penguin', price: 25 }, { id: 'frog', price: 30 },
  { id: 'pig', price: 30 }, { id: 'ghost', price: 50 }, { id: 'robot', price: 75 },
  { id: 'ninja', price: 100 }, { id: 'lava', price: 150 }, { id: 'galaxy', price: 200 },
  { id: 'diamond', price: 300 }, { id: 'golden', price: 500 },
];

const SNAKE_SKINS: { id: string; price: number }[] = [
  { id: 'classic', price: 0 }, { id: 'ice', price: 15 }, { id: 'berry', price: 15 },
  { id: 'ocean', price: 25 }, { id: 'sunset', price: 30 }, { id: 'neon', price: 40 },
  { id: 'venom', price: 60 }, { id: 'lava', price: 80 }, { id: 'rainbow', price: 120 },
  { id: 'cosmic', price: 200 },
];

const DOODLE_SKINS: { id: string; price: number }[] = [
  { id: 'doodler', price: 0 }, { id: 'alien', price: 20 }, { id: 'snowman', price: 20 },
  { id: 'pumpkin', price: 30 }, { id: 'robot', price: 40 }, { id: 'astronaut', price: 60 },
  { id: 'wizard', price: 80 }, { id: 'phoenix', price: 120 }, { id: 'crystal', price: 200 },
];

const FLAPPY_SKINS: { id: string; price: number }[] = [
  { id: 'sparrow', price: 0 }, { id: 'bluejay', price: 15 }, { id: 'robin', price: 15 },
  { id: 'parrot', price: 25 }, { id: 'flamingo', price: 30 }, { id: 'owl', price: 40 },
  { id: 'penguin', price: 60 }, { id: 'phoenix', price: 100 }, { id: 'icebird', price: 150 },
];

const PONG_SKINS: { id: string; price: number }[] = [
  { id: 'default', price: 0 }, { id: 'ember', price: 15 }, { id: 'frost', price: 15 },
  { id: 'toxic', price: 25 }, { id: 'solar', price: 30 }, { id: 'violet', price: 40 },
  { id: 'blood', price: 60 }, { id: 'gold', price: 80 }, { id: 'neon', price: 120 },
  { id: 'plasma', price: 200 },
];

const TETRIS_SKINS: { id: string; price: number }[] = [
  { id: 'classic', price: 0 }, { id: 'ocean', price: 15 }, { id: 'sunset', price: 15 },
  { id: 'forest', price: 25 }, { id: 'candy', price: 30 }, { id: 'mono', price: 40 },
  { id: 'neon', price: 60 }, { id: 'ice', price: 80 }, { id: 'lava', price: 120 },
  { id: 'aurora', price: 200 },
];

const SKIN_GAMES: { gameId: string; nameKeyPrefix: string; skins: { id: string; price: number }[] }[] = [
  { gameId: 'crossyroad', nameKeyPrefix: 'crossyroad.skin', skins: CROSSY_SKINS },
  { gameId: 'snake', nameKeyPrefix: 'snake.skin', skins: SNAKE_SKINS },
  { gameId: 'doodlejump', nameKeyPrefix: 'doodlejump.skin', skins: DOODLE_SKINS },
  { gameId: 'flappy', nameKeyPrefix: 'flappy.skin', skins: FLAPPY_SKINS },
  { gameId: 'pong', nameKeyPrefix: 'pong.skin', skins: PONG_SKINS },
  { gameId: 'tetris', nameKeyPrefix: 'tetris.skin', skins: TETRIS_SKINS },
];

const DIFF_COLORS = {
  easy: { bg: 'bg-emerald-950/30', border: 'border-emerald-900/40', text: 'text-emerald-400' },
  medium: { bg: 'bg-amber-950/30', border: 'border-amber-900/40', text: 'text-amber-400' },
  hard: { bg: 'bg-rose-950/30', border: 'border-rose-900/40', text: 'text-rose-400' },
};

const SUDOKU_DIFFS = ['easy', 'medium', 'hard', 'expert'] as const;
const MINESWEEPER_DIFFS = ['easy', 'medium', 'hard'] as const;

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

      {/* Game Progress */}
      <Section title={t('admin.gameProgress.title')}>
        <GameProgressManager
          gameProgress={user.gameProgress}
          actionLoading={actionLoading}
          confirm={confirm}
          t={t}
          onSetProgress={(game, data) => quickAction({ action: 'set_game_progress', game, data }, `set_gp_${game}`)}
          onResetProgress={(game) => doAction({ action: 'reset_game_progress', game }, `reset_gp_${game}`)}
          onCancelConfirm={() => setConfirm(null)}
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

// ── Game Progress Manager ────────────────────────────────────────────────────

function GameProgressManager({
  gameProgress, actionLoading, confirm, t, onSetProgress, onResetProgress, onCancelConfirm,
}: {
  gameProgress: Record<string, unknown> | null;
  actionLoading: string | null;
  confirm: string | null;
  t: (key: string) => string;
  onSetProgress: (game: string, data: unknown) => void;
  onResetProgress: (game: string) => void;
  onCancelConfirm: () => void;
}) {
  const [activeTab, setActiveTab] = useState<string>('mahjong');

  // ── Mahjong state ──
  const rawMahjong = gameProgress?.mahjong as MahjongProgress | string[] | undefined;
  const mahjong: MahjongProgress = Array.isArray(rawMahjong)
    ? { completed: rawMahjong, unlocked: rawMahjong }
    : (rawMahjong && typeof rawMahjong === 'object' && 'completed' in rawMahjong)
      ? { completed: rawMahjong.completed ?? [], unlocked: rawMahjong.unlocked ?? [] }
      : { completed: [], unlocked: [] };

  const completedSet = new Set(mahjong.completed);
  const unlockedSet = new Set(mahjong.unlocked);

  // ── Generic skin game state ──
  const [walletInput, setWalletInput] = useState('');

  function getSkinProgress(gameId: string, defaultSkin: string): CrossyProgress {
    const raw = gameProgress?.[gameId] as CrossyProgress | undefined;
    if (raw && typeof raw === 'object' && 'wallet' in raw) {
      return { wallet: raw.wallet ?? 0, owned: raw.owned ?? [defaultSkin], activeSkin: raw.activeSkin ?? defaultSkin };
    }
    return { wallet: 0, owned: [defaultSkin], activeSkin: defaultSkin };
  }

  // ── Sudoku state ──
  const rawSudoku = gameProgress?.sudoku as { unlockedDifficulties?: string[] } | undefined;
  const sudokuUnlocked = new Set(rawSudoku?.unlockedDifficulties ?? []);

  // ── Minesweeper state ──
  const rawMinesweeper = gameProgress?.minesweeper as { unlockedDifficulties?: string[] } | undefined;
  const minesweeperUnlocked = new Set(rawMinesweeper?.unlockedDifficulties ?? []);

  function saveMahjong(completed: string[], unlocked: string[]) {
    onSetProgress('mahjong', { completed, unlocked });
  }

  function toggleMahjongCompleted(layoutId: string) {
    const newCompleted = completedSet.has(layoutId)
      ? mahjong.completed.filter((l) => l !== layoutId)
      : [...mahjong.completed, layoutId];
    const newUnlocked = unlockedSet.has(layoutId) ? mahjong.unlocked : [...mahjong.unlocked, layoutId];
    saveMahjong(newCompleted, newUnlocked);
  }

  function toggleMahjongUnlocked(layoutId: string) {
    const newUnlocked = unlockedSet.has(layoutId)
      ? mahjong.unlocked.filter((l) => l !== layoutId)
      : [...mahjong.unlocked, layoutId];
    saveMahjong(mahjong.completed, newUnlocked);
  }

  function unlockAllMahjong(difficulty?: 'easy' | 'medium' | 'hard') {
    const targets = difficulty
      ? MAHJONG_LAYOUTS.filter((l) => l.difficulty === difficulty).map((l) => l.id)
      : MAHJONG_LAYOUTS.map((l) => l.id);
    const newUnlocked = [...new Set([...mahjong.unlocked, ...targets])];
    saveMahjong(mahjong.completed, newUnlocked);
  }

  function completeAllMahjong(difficulty?: 'easy' | 'medium' | 'hard') {
    const targets = difficulty
      ? MAHJONG_LAYOUTS.filter((l) => l.difficulty === difficulty).map((l) => l.id)
      : MAHJONG_LAYOUTS.map((l) => l.id);
    const newCompleted = [...new Set([...mahjong.completed, ...targets])];
    const newUnlocked = [...new Set([...mahjong.unlocked, ...targets])];
    saveMahjong(newCompleted, newUnlocked);
  }

  function saveSkinGame(gameId: string, defaultSkin: string, updates: Partial<CrossyProgress>) {
    const current = getSkinProgress(gameId, defaultSkin);
    onSetProgress(gameId, { ...current, ...updates });
  }

  function toggleSkin(gameId: string, defaultSkin: string, skinId: string) {
    const p = getSkinProgress(gameId, defaultSkin);
    const owned = new Set(p.owned);
    const newOwned = owned.has(skinId) ? p.owned.filter((s) => s !== skinId) : [...p.owned, skinId];
    saveSkinGame(gameId, defaultSkin, { owned: newOwned });
  }

  function grantAllSkins(gameId: string, defaultSkin: string, skins: { id: string }[]) {
    saveSkinGame(gameId, defaultSkin, { owned: skins.map((s) => s.id) });
  }

  function handleSetWallet(gameId: string, defaultSkin: string) {
    const val = parseInt(walletInput, 10);
    if (isNaN(val) || val < 0) return;
    saveSkinGame(gameId, defaultSkin, { wallet: val });
    setWalletInput('');
  }

  function toggleDiffUnlock(game: 'sudoku' | 'minesweeper', diff: string) {
    const current = game === 'sudoku' ? sudokuUnlocked : minesweeperUnlocked;
    const newSet = new Set(current);
    if (newSet.has(diff)) newSet.delete(diff);
    else newSet.add(diff);
    onSetProgress(game, { unlockedDifficulties: [...newSet] });
  }

  function unlockAllDiffs(game: 'sudoku' | 'minesweeper') {
    const diffs = game === 'sudoku' ? SUDOKU_DIFFS : MINESWEEPER_DIFFS;
    onSetProgress(game, { unlockedDifficulties: [...diffs] });
  }

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-0.5 bg-zinc-800/50 rounded-md p-0.5 flex-wrap">
        {[
          ['mahjong', 'Mahjong'],
          ['crossyroad', 'Crossy Road'],
          ['snake', 'Snake'],
          ['doodlejump', 'Doodle Jump'],
          ['flappy', 'Flappy Bird'],
          ['pong', 'Pong'],
          ['tetris', 'Tetris'],
          ['sudoku', 'Sudoku'],
          ['minesweeper', 'Minesweeper'],
        ].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === tab ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >{label}</button>
        ))}
      </div>

      {activeTab === 'mahjong' && (
        <div className="space-y-3">
          {/* Stats row */}
          <div className="flex gap-3 text-xs">
            <div className="rounded-md bg-zinc-800/30 border border-zinc-700/30 px-2.5 py-2">
              <p className="text-[10px] text-zinc-500">{t('admin.gameProgress.completed')}</p>
              <p className="text-zinc-200 font-semibold tabular-nums">{completedSet.size} / {MAHJONG_LAYOUTS.length}</p>
            </div>
            <div className="rounded-md bg-zinc-800/30 border border-zinc-700/30 px-2.5 py-2">
              <p className="text-[10px] text-zinc-500">{t('admin.gameProgress.unlocked')}</p>
              <p className="text-zinc-200 font-semibold tabular-nums">{unlockedSet.size} / {MAHJONG_LAYOUTS.length}</p>
            </div>
          </div>

          {/* Bulk actions per difficulty */}
          {(['easy', 'medium', 'hard'] as const).map((diff) => {
            const layouts = MAHJONG_LAYOUTS.filter((l) => l.difficulty === diff);
            const dc = DIFF_COLORS[diff];
            const diffCompleted = layouts.filter((l) => completedSet.has(l.id)).length;
            const diffUnlocked = layouts.filter((l) => unlockedSet.has(l.id)).length;

            return (
              <div key={diff} className={`rounded-lg ${dc.bg} border ${dc.border} p-3 space-y-2`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-semibold ${dc.text} uppercase tracking-wider`}>
                    {t(`admin.gameProgress.diff.${diff}`)}
                  </span>
                  <span className="text-[10px] text-zinc-500 tabular-nums">
                    {diffCompleted}/{layouts.length} {t('admin.gameProgress.completed').toLowerCase()}
                    {' · '}
                    {diffUnlocked}/{layouts.length} {t('admin.gameProgress.unlocked').toLowerCase()}
                  </span>
                  <div className="ml-auto flex gap-1">
                    <button onClick={() => unlockAllMahjong(diff)}
                      disabled={diffUnlocked === layouts.length || actionLoading === 'set_gp_mahjong'}
                      className="px-2 py-0.5 rounded text-[10px] font-medium border border-indigo-800/60 text-indigo-400 hover:bg-indigo-900/30 transition-colors disabled:opacity-40">
                      {t('admin.gameProgress.unlockAll')}
                    </button>
                    <button onClick={() => completeAllMahjong(diff)}
                      disabled={diffCompleted === layouts.length || actionLoading === 'set_gp_mahjong'}
                      className="px-2 py-0.5 rounded text-[10px] font-medium border border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/30 transition-colors disabled:opacity-40">
                      {t('admin.gameProgress.completeAll')}
                    </button>
                  </div>
                </div>

                {/* Layout grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1">
                  {layouts.map((layout) => {
                    const completed = completedSet.has(layout.id);
                    const unlocked = unlockedSet.has(layout.id);
                    return (
                      <div key={layout.id}
                        className={`rounded-md px-2 py-1.5 text-center transition-colors ${
                          completed
                            ? 'bg-emerald-950/40 border border-emerald-800/50'
                            : unlocked
                              ? 'bg-indigo-950/30 border border-indigo-800/40'
                              : 'bg-zinc-900/50 border border-zinc-800/50'
                        }`}
                      >
                        <p className="text-[10px] text-zinc-300 font-medium truncate">{t(`mahjong.layout.${layout.id}`)}</p>
                        <p className="text-[9px] text-zinc-600 font-mono">{layout.id}</p>
                        <div className="flex gap-1 mt-1 justify-center">
                          <button onClick={() => toggleMahjongUnlocked(layout.id)}
                            disabled={actionLoading === 'set_gp_mahjong'}
                            title={unlocked ? t('admin.gameProgress.lock') : t('admin.gameProgress.unlock')}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors disabled:opacity-40 ${
                              unlocked
                                ? 'bg-indigo-900/40 text-indigo-400 hover:bg-indigo-900/60'
                                : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                            }`}
                          >{unlocked ? '🔓' : '🔒'}</button>
                          <button onClick={() => toggleMahjongCompleted(layout.id)}
                            disabled={actionLoading === 'set_gp_mahjong'}
                            title={completed ? t('admin.gameProgress.uncomplete') : t('admin.gameProgress.complete')}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors disabled:opacity-40 ${
                              completed
                                ? 'bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60'
                                : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                            }`}
                          >{completed ? '✓' : '○'}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Global bulk + reset */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => unlockAllMahjong()}
              disabled={unlockedSet.size === MAHJONG_LAYOUTS.length || actionLoading === 'set_gp_mahjong'}
              className="px-2.5 py-1 rounded-md text-[10px] font-semibold border border-indigo-800/60 text-indigo-400 hover:bg-indigo-900/30 transition-colors disabled:opacity-40">
              {t('admin.gameProgress.unlockAll')} ({MAHJONG_LAYOUTS.length - unlockedSet.size})
            </button>
            <button onClick={() => completeAllMahjong()}
              disabled={completedSet.size === MAHJONG_LAYOUTS.length || actionLoading === 'set_gp_mahjong'}
              className="px-2.5 py-1 rounded-md text-[10px] font-semibold border border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/30 transition-colors disabled:opacity-40">
              {t('admin.gameProgress.completeAll')} ({MAHJONG_LAYOUTS.length - completedSet.size})
            </button>
            <ActionButton
              label={t('admin.gameProgress.reset')} variant="danger"
              loading={actionLoading === 'reset_gp_mahjong'} confirming={confirm === 'reset_gp_mahjong'}
              onClick={() => onResetProgress('mahjong')}
              onCancel={onCancelConfirm}
            />
          </div>
        </div>
      )}

      {SKIN_GAMES.some((sg) => sg.gameId === activeTab) && (() => {
        const sg = SKIN_GAMES.find((s) => s.gameId === activeTab)!;
        const defaultSkin = sg.skins[0].id;
        const progress = getSkinProgress(sg.gameId, defaultSkin);
        const ownedSet = new Set(progress.owned);
        return (
          <div className="space-y-3">
            {/* Wallet */}
            <div className="rounded-lg bg-amber-950/20 border border-amber-900/30 p-3 space-y-2">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[10px] text-zinc-500">{t('admin.gameProgress.wallet')}</p>
                  <p className="text-amber-400 font-bold text-lg tabular-nums">{progress.wallet}</p>
                </div>
                <div className="ml-auto flex gap-1.5 items-center">
                  <input
                    type="number"
                    value={walletInput}
                    onChange={(e) => setWalletInput(e.target.value)}
                    placeholder={String(progress.wallet)}
                    min="0"
                    className="w-24 bg-zinc-800/50 border border-zinc-700/50 rounded-md px-2.5 py-1 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSetWallet(sg.gameId, defaultSkin); }}
                  />
                  <button onClick={() => handleSetWallet(sg.gameId, defaultSkin)}
                    disabled={actionLoading === `set_gp_${sg.gameId}`}
                    className="px-2.5 py-1 rounded-md text-[10px] font-medium border border-amber-800/60 text-amber-400 hover:bg-amber-900/30 transition-colors disabled:opacity-40">
                    {t('admin.progression.apply')}
                  </button>
                </div>
              </div>
              <div className="flex gap-1 flex-wrap">
                {[50, 100, 250, 500, 1000].map((amount) => (
                  <button key={amount}
                    onClick={() => saveSkinGame(sg.gameId, defaultSkin, { wallet: progress.wallet + amount })}
                    disabled={actionLoading === `set_gp_${sg.gameId}`}
                    className="px-2 py-0.5 rounded text-[10px] font-medium border border-amber-800/40 text-amber-400/70 hover:bg-amber-900/20 transition-colors disabled:opacity-40">
                    +{amount}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-zinc-500">
              {t('admin.gameProgress.activeSkin')}: <span className="text-zinc-300 font-medium">{progress.activeSkin}</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap mb-1">
              <button onClick={() => grantAllSkins(sg.gameId, defaultSkin, sg.skins)}
                disabled={ownedSet.size === sg.skins.length || actionLoading === `set_gp_${sg.gameId}`}
                className="px-2.5 py-1 rounded-md text-[10px] font-semibold border border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/30 transition-colors disabled:opacity-40">
                {t('admin.gameProgress.grantAllSkins')} ({sg.skins.length - ownedSet.size})
              </button>
              <ActionButton
                label={t('admin.gameProgress.reset')} variant="danger"
                loading={actionLoading === `reset_gp_${sg.gameId}`} confirming={confirm === `reset_gp_${sg.gameId}`}
                onClick={() => onResetProgress(sg.gameId)}
                onCancel={onCancelConfirm}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {sg.skins.map((skin) => {
                const owned = ownedSet.has(skin.id);
                return (
                  <div key={skin.id}
                    className={`rounded-md px-2.5 py-2 transition-colors ${
                      owned ? 'bg-emerald-950/30 border border-emerald-800/40' : 'bg-zinc-900/50 border border-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] text-zinc-200 font-medium truncate">{t(`${sg.nameKeyPrefix}.${skin.id}`)}</p>
                        <p className="text-[9px] text-zinc-500 tabular-nums">{skin.price === 0 ? t('admin.gameProgress.free') : `${skin.price} coins`}</p>
                      </div>
                      <button onClick={() => toggleSkin(sg.gameId, defaultSkin, skin.id)}
                        disabled={actionLoading === `set_gp_${sg.gameId}`}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border shrink-0 transition-colors disabled:opacity-40 ${
                          owned
                            ? 'border-rose-800/60 text-rose-400 hover:bg-rose-900/30'
                            : 'border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/30'
                        }`}
                      >{owned ? t('admin.gameProgress.revoke') : t('admin.gameProgress.grant')}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {(activeTab === 'sudoku' || activeTab === 'minesweeper') && (() => {
        const game = activeTab;
        const diffs = game === 'sudoku' ? SUDOKU_DIFFS : MINESWEEPER_DIFFS;
        const unlocked = game === 'sudoku' ? sudokuUnlocked : minesweeperUnlocked;
        return (
          <div className="space-y-3">
            <p className="text-[11px] text-zinc-500">
              {t('admin.gameProgress.diffUnlockHint')}
            </p>

            <div className="flex items-center gap-2 flex-wrap mb-2">
              <button onClick={() => unlockAllDiffs(game)}
                disabled={unlocked.size === diffs.length || actionLoading === `set_gp_${game}`}
                className="px-2.5 py-1 rounded-md text-[10px] font-semibold border border-indigo-800/60 text-indigo-400 hover:bg-indigo-900/30 transition-colors disabled:opacity-40">
                {t('admin.gameProgress.unlockAll')}
              </button>
              <ActionButton
                label={t('admin.gameProgress.reset')} variant="danger"
                loading={actionLoading === `reset_gp_${game}`} confirming={confirm === `reset_gp_${game}`}
                onClick={() => onResetProgress(game)}
                onCancel={onCancelConfirm}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {diffs.map((diff) => {
                const isUnlocked = unlocked.has(diff);
                const alwaysOpen = diff === 'easy';
                return (
                  <div key={diff}
                    className={`rounded-lg px-3 py-3 text-center transition-colors ${
                      alwaysOpen
                        ? 'bg-emerald-950/30 border border-emerald-800/40'
                        : isUnlocked
                          ? 'bg-indigo-950/30 border border-indigo-800/40'
                          : 'bg-zinc-900/50 border border-zinc-800/50'
                    }`}
                  >
                    <p className={`text-[12px] font-semibold ${
                      alwaysOpen ? 'text-emerald-400' : isUnlocked ? 'text-indigo-400' : 'text-zinc-400'
                    }`}>
                      {t(`admin.gameProgress.diff.${diff}`)}
                    </p>
                    {alwaysOpen ? (
                      <p className="text-[9px] text-emerald-500/60 mt-1">{t('admin.gameProgress.alwaysOpen')}</p>
                    ) : (
                      <button onClick={() => toggleDiffUnlock(game, diff)}
                        disabled={actionLoading === `set_gp_${game}`}
                        className={`mt-1.5 px-2.5 py-0.5 rounded text-[10px] font-medium border transition-colors disabled:opacity-40 ${
                          isUnlocked
                            ? 'border-rose-800/60 text-rose-400 hover:bg-rose-900/30'
                            : 'border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/30'
                        }`}
                      >{isUnlocked ? t('admin.gameProgress.lock') : t('admin.gameProgress.unlock')}</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
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
