import type { ChatMessage } from 'shared';
import type { CosmeticsFields } from './cosmetics.js';

// ── Identity / profile state (shared by chat, rooms, invites, presence) ──────

export interface Profile extends CosmeticsFields {
  nickname: string;
}

/** playerToken → profile (nickname, avatar, name color, cosmetics) */
export const profiles = new Map<string, Profile>();

/** socketId → playerToken for ALL identified sockets (not just room players) */
export const identifiedTokens = new Map<string, string>();

/** socketId → nickname for all identified sockets */
export const nicknameMap = new Map<string, string>();

// ── Chat buffers ─────────────────────────────────────────────────────────────

export const CHAT_RATE_MSGS = 5;
export const CHAT_RATE_WINDOW_MS = 10_000;
export const GLOBAL_CHAT_BUF = 100;
export const ROOM_CHAT_BUF = 50;
export const MSG_MAX_LEN = 200;

/** Global chat buffer — last GLOBAL_CHAT_BUF messages */
export const globalChat: ChatMessage[] = [];

/** roomCode → chat buffer — last ROOM_CHAT_BUF messages */
export const roomChats = new Map<string, ChatMessage[]>();

/** playerToken → recent message timestamps (sliding-window rate limiter) */
export const chatTimestamps = new Map<string, number[]>();

/** Append to the global chat buffer, evicting the oldest beyond the cap. */
export function pushGlobalChat(msg: ChatMessage) {
  globalChat.push(msg);
  if (globalChat.length > GLOBAL_CHAT_BUF) globalChat.shift();
}

// ── Sanitizers / rate limiting ───────────────────────────────────────────────

export function sanitizeNickname(raw: string): string | null {
  const cleaned = raw.trim().slice(0, 16);
  if (cleaned.length < 2) return null;
  if (!/^[a-zA-Z0-9 _-]+$/.test(cleaned)) return null;
  return cleaned;
}

/** Lenient variant for handlers that need a usable nickname no matter what the client sent. */
export function safeNickname(raw: unknown): string {
  return sanitizeNickname(String(raw ?? '')) ?? 'Player';
}

export function sanitizeMessage(raw: string): string | null {
  const cleaned = raw.trim().slice(0, MSG_MAX_LEN);
  return cleaned.length > 0 ? cleaned : null;
}

export function canChat(token: string): boolean {
  const now = Date.now();
  const cutoff = now - CHAT_RATE_WINDOW_MS;
  const times = (chatTimestamps.get(token) ?? []).filter((t) => t > cutoff);
  if (times.length >= CHAT_RATE_MSGS) return false;
  times.push(now);
  chatTimestamps.set(token, times);
  return true;
}

/** Periodic cleanup: drop stale rate-limiter entries. */
export function cleanChatTimestamps() {
  const now = Date.now();
  for (const [token, timestamps] of chatTimestamps) {
    const recent = timestamps.filter((t) => now - t < CHAT_RATE_WINDOW_MS);
    if (recent.length === 0) chatTimestamps.delete(token);
    else chatTimestamps.set(token, recent);
  }
}
