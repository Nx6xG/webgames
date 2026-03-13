'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOnlinePresence } from '@/components/providers/OnlinePresenceProvider';
import { usePartyCtx } from '@/components/providers/PartyProvider';
import { useI18n } from '@/components/providers/LanguageProvider';
import { useClickOutside, useEscape } from '@/hooks/useClickOutside';
import { OnlineUsersDrawer } from './OnlineUsersDrawer';
import { InviteDialog } from './InviteDialog';
import { PartyPanel } from './PartyPanel';
import { ProfileViewerModal } from '@/components/ui/ProfileViewerModal';
import { resolveOtherProfile, resolveMyProfile, resolveCloudProfile } from '@/lib/profileData';
import { useNickname } from '@/components/providers/NicknameProvider';
import { useAuth } from '@/components/providers/AuthProvider';
import type { ProfileData } from '@/lib/profileData';
import type { InvitePayload, GameId, OnlineUser } from 'shared';

const TOKEN_KEY = 'wg_player_token';

/** Maps gameId → i18n title key (mirrors the web registry). */
const GAME_TITLE_KEYS: Record<string, string> = {
  tictactoe:  'lobby.games.tictactoe.title',
  connect4:   'lobby.games.connect4.title',
  rps:        'lobby.games.rps.title',
  chess:      'lobby.games.chess.title',
  battleship: 'lobby.games.battleship.title',
};

export function OnlineNavChip() {
  const { user } = useAuth();
  const {
    users, connected,
    incomingInvites, sentInvite, inviteError,
    acceptedInvite,
    sendInvite, acceptInvite, dismissInvite, dismissSentInvite, dismissAcceptedInvite,
  } = useOnlinePresence();

  const {
    party, incomingPartyInvite, partyError, gameStarting,
    createParty, joinParty, leaveParty, kickFromParty,
    dismissPartyInvite, dismissGameStarting,
  } = usePartyCtx();

  const { t } = useI18n();
  const router = useRouter();
  const { nickname: myNickname } = useNickname();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [partyOpen, setPartyOpen]   = useState(false);
  const [myToken, setMyToken]       = useState('');
  const [inviteTarget, setInviteTarget] = useState<{ token: string; nickname: string } | null>(null);
  const [viewedProfile, setViewedProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | undefined>(undefined);

  const chipRef        = useRef<HTMLButtonElement>(null);
  const drawerPanelRef = useRef<HTMLDivElement>(null);
  const partyPanelRef  = useRef<HTMLDivElement>(null);

  const closeDrawer = () => setDrawerOpen(false);
  useClickOutside([chipRef, drawerPanelRef], closeDrawer, drawerOpen);
  useEscape(closeDrawer, drawerOpen);

  // Close party panel on click outside
  const partyChipRef = useRef<HTMLButtonElement>(null);
  useClickOutside([partyChipRef, partyPanelRef], () => setPartyOpen(false), partyOpen);

  // Read token after mount
  useEffect(() => {
    setMyToken(localStorage.getItem(TOKEN_KEY) ?? '');
  }, []);

  // Auto-expire oldest incoming invite after 60 s
  useEffect(() => {
    if (incomingInvites.length === 0) return;
    const oldest = incomingInvites[0];
    const remaining = 60_000 - (Date.now() - oldest.createdAt);
    if (remaining <= 0) { dismissInvite(oldest.id); return; }
    const timer = setTimeout(() => dismissInvite(oldest.id), remaining);
    return () => clearTimeout(timer);
  }, [incomingInvites, dismissInvite]);

  // Auto-dismiss sent-invite notice after 12 s
  useEffect(() => {
    if (!sentInvite) return;
    const timer = setTimeout(() => dismissSentInvite(), 12_000);
    return () => clearTimeout(timer);
  }, [sentInvite, dismissSentInvite]);

  // Auto-join 3 s after invite is accepted
  useEffect(() => {
    if (!acceptedInvite) return;
    const timer = setTimeout(() => {
      router.push(`/games/${acceptedInvite.gameId}?room=${acceptedInvite.roomCode}`);
      dismissAcceptedInvite();
    }, 3_000);
    return () => clearTimeout(timer);
  }, [acceptedInvite, router, dismissAcceptedInvite]);

  // Auto-open party panel when party appears
  useEffect(() => {
    if (party) setPartyOpen(true);
    else setPartyOpen(false);
  }, [!!party]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-navigate when party host launches a game
  useEffect(() => {
    if (!gameStarting) return;
    router.push(`/games/${gameStarting.gameId}?room=${gameStarting.roomCode}`);
    dismissGameStarting();
  }, [gameStarting, router, dismissGameStarting]);

  // ── Mutual exclusion: only one panel open at a time ──
  function openDrawer() {
    setPartyOpen(false);
    setDrawerOpen(true);
  }
  function toggleParty() {
    setDrawerOpen(false);
    setPartyOpen((o) => !o);
  }

  function handleOpenInviteDialog(token: string, nickname: string) {
    setInviteTarget({ token, nickname });
    setDrawerOpen(false);
  }

  function handleSendInvite(gameId: GameId) {
    if (!inviteTarget) return;
    sendInvite(inviteTarget.token, gameId);
    setInviteTarget(null);
  }

  function handleAcceptInvite(invite: InvitePayload) {
    acceptInvite(invite);
    dismissInvite(invite.id);
    router.push(`/games/${invite.gameId}?room=${invite.roomCode}`);
  }

  function handleJoinRoom(gameId: GameId, roomCode: string) {
    setDrawerOpen(false);
    router.push(`/games/${gameId}?room=${roomCode}`);
  }

  function handleAcceptPartyInvite() {
    if (!incomingPartyInvite) return;
    joinParty(incomingPartyInvite.partyId);
    dismissPartyInvite();
  }

  function handlePartyInvite() {
    setPartyOpen(false);
    openDrawer();
  }

  function handleViewProfile(onlineUser: OnlineUser) {
    const isMe = onlineUser.playerToken === myToken;
    if (isMe) {
      setViewedProfile(resolveMyProfile(myNickname, myToken));
      setProfileUserId(user?.id);
      setProfileLoading(false);
      return;
    }
    setViewedProfile(resolveOtherProfile(onlineUser.playerToken, onlineUser.nickname, onlineUser.cosmetics, onlineUser.showcase));
    setProfileUserId(onlineUser.userId);
    if (onlineUser.userId) {
      setProfileLoading(true);
      resolveCloudProfile(onlineUser.userId, onlineUser.nickname, onlineUser.cosmetics)
        .then((cloud) => { cloud.showcase = onlineUser.showcase; setViewedProfile(cloud); })
        .finally(() => setProfileLoading(false));
    }
  }

  const hasNotifications = incomingInvites.length > 0 || !!sentInvite || !!inviteError || !!acceptedInvite || !!incomingPartyInvite || !!partyError;

  return (
    <>
      {/* ── Online chip ────────────────────────────────────────────────── */}
      <button
        ref={chipRef}
        onClick={() => drawerOpen ? setDrawerOpen(false) : openDrawer()}
        aria-label="Show online users"
        aria-expanded={drawerOpen}
        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/40 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
      >
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${connected ? 'bg-emerald-500' : 'bg-zinc-600'}`}
          aria-hidden
        />
        <span className="hidden sm:inline">{t('online.title')}</span>
        <span className="rounded-full bg-emerald-500/15 px-1.5 py-px text-[11px] text-emerald-300 font-medium tabular-nums">
          {users.length}
        </span>
      </button>

      {/* ── Party chip ─────────────────────────────────────────────────── */}
      {party ? (
        <button
          ref={partyChipRef}
          onClick={toggleParty}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            partyOpen
              ? 'border-indigo-500 bg-indigo-600/25 text-indigo-200'
              : 'border-indigo-700/60 bg-indigo-950/50 text-indigo-300 hover:bg-indigo-900/40 hover:text-indigo-200'
          }`}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden sm:inline">{t('party.title')}</span>
          <span className="rounded-full bg-indigo-500/20 px-1.5 py-px text-[11px] text-indigo-200 font-semibold tabular-nums">
            {party.members.length}
          </span>
        </button>
      ) : (
        <button
          onClick={createParty}
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/40 px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          title={t('party.create')}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden sm:inline">{t('party.create')}</span>
        </button>
      )}

      {/* ── Online users drawer ───────────────────────────────────────── */}
      <OnlineUsersDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        users={users}
        connected={connected}
        myToken={myToken}
        onInvite={handleOpenInviteDialog}
        onJoinRoom={handleJoinRoom}
        onViewProfile={handleViewProfile}
        panelRef={drawerPanelRef}
      />

      {/* ── Party dropdown ────────────────────────────────────────────── */}
      {party && (
        <div ref={partyPanelRef}>
          <PartyPanel
            open={partyOpen}
            party={party}
            onClose={() => setPartyOpen(false)}
            onLeave={() => { leaveParty(); setPartyOpen(false); }}
            onKick={kickFromParty}
            onInvite={handlePartyInvite}
          />
        </div>
      )}

      {/* ── Invite dialog (game picker) ───────────────────────────────── */}
      <InviteDialog
        open={!!inviteTarget}
        onClose={() => setInviteTarget(null)}
        target={inviteTarget}
        onSend={handleSendInvite}
      />

      {/* ── Notification stack (top-right) ─────────────────────────────── */}
      {hasNotifications && (
        <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">

          {/* Incoming invite toasts (max 3) */}
          {incomingInvites.slice(0, 3).map((inv) => (
            <div
              key={inv.id}
              className="pointer-events-auto w-[300px] rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl p-4"
            >
              <div className="flex items-start gap-3 mb-3">
                <span className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-black text-white shrink-0 select-none">
                  {inv.fromName.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-100 truncate">{inv.fromName}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {t('invite.receivedPre')}{' '}
                    <span className="text-zinc-300 font-medium">
                      {t(GAME_TITLE_KEYS[inv.gameId] ?? inv.gameId)}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => dismissInvite(inv.id)}
                  className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors p-0.5 rounded"
                  aria-label="Dismiss"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAcceptInvite(inv)}
                  className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                >
                  {t('invite.accept')}
                </button>
                <button
                  onClick={() => dismissInvite(inv.id)}
                  className="flex-1 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
                >
                  {t('invite.decline')}
                </button>
              </div>
            </div>
          ))}

          {/* Invite accepted toast */}
          {acceptedInvite && (
            <div className="pointer-events-auto w-[300px] rounded-xl border border-indigo-800/50 bg-zinc-900 shadow-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-black text-white shrink-0 select-none">
                  {acceptedInvite.byName.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-100 truncate">{acceptedInvite.byName}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{t('invite.accepted')}</p>
                </div>
                <button
                  onClick={dismissAcceptedInvite}
                  className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors p-0.5 rounded"
                  aria-label="Dismiss"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => {
                  router.push(`/games/${acceptedInvite.gameId}?room=${acceptedInvite.roomCode}`);
                  dismissAcceptedInvite();
                }}
                className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors mb-2"
              >
                {t('invite.joinGame')}
              </button>
              <div className="h-1 bg-zinc-800 rounded overflow-hidden">
                <div className="h-full bg-indigo-500 invite-timer-bar" />
              </div>
            </div>
          )}

          {/* Sent-invite confirmation */}
          {sentInvite && (
            <div className="pointer-events-auto w-[300px] rounded-xl border border-emerald-800/50 bg-zinc-900 shadow-xl px-4 py-3 flex items-center gap-3">
              <span className="text-emerald-400 shrink-0 text-base leading-none">✓</span>
              <p className="text-sm font-medium text-zinc-100 flex-1 min-w-0">{t('invite.sentNotice')}</p>
              <Link
                href={`/games/${sentInvite.gameId}?room=${sentInvite.roomCode}`}
                className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors whitespace-nowrap"
              >
                {t('invite.goToGame')} →
              </Link>
              <button
                onClick={() => dismissSentInvite()}
                className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors p-0.5 rounded"
                aria-label="Dismiss"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Invite error */}
          {inviteError && (
            <div className="pointer-events-auto w-[300px] rounded-xl border border-rose-800/50 bg-zinc-900 shadow-xl px-4 py-3 flex items-center gap-3">
              <span className="text-rose-400 shrink-0 text-base leading-none">⚠</span>
              <p className="text-sm text-zinc-300 flex-1 min-w-0">{inviteError}</p>
            </div>
          )}

          {/* Party invite toast */}
          {incomingPartyInvite && (
            <div className="pointer-events-auto w-[300px] rounded-xl border border-indigo-700 bg-zinc-900 shadow-2xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <span className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-black text-white shrink-0 select-none">
                  {incomingPartyInvite.fromName.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-100 truncate">{incomingPartyInvite.fromName}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{t('party.inviteReceived')}</p>
                </div>
                <button
                  onClick={dismissPartyInvite}
                  className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors p-0.5 rounded"
                  aria-label="Dismiss"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAcceptPartyInvite}
                  className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                >
                  {t('party.join')}
                </button>
                <button
                  onClick={dismissPartyInvite}
                  className="flex-1 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
                >
                  {t('invite.decline')}
                </button>
              </div>
            </div>
          )}

          {/* Party error toast */}
          {partyError && (
            <div className="pointer-events-auto w-[300px] rounded-xl border border-rose-800/50 bg-zinc-900 shadow-xl px-4 py-3 flex items-center gap-3">
              <span className="text-rose-400 shrink-0 text-base leading-none">⚠</span>
              <p className="text-sm text-zinc-300 flex-1 min-w-0">{partyError.message}</p>
            </div>
          )}

        </div>
      )}

      {/* ── Profile viewer modal ──────────────────────────────────────── */}
      {viewedProfile && (
        <ProfileViewerModal
          profile={viewedProfile}
          onClose={() => { setViewedProfile(null); setProfileUserId(undefined); setProfileLoading(false); }}
          loading={profileLoading}
          userId={profileUserId}
        />
      )}
    </>
  );
}
