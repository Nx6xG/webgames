export const NICK_KEY = 'wg_nickname';

const NICK_PATTERN = /^[a-zA-Z0-9 _-]+$/;
const NICK_MAX = 18;

const NICK_ADJ = ['Blue', 'Red', 'Wild', 'Dark', 'Swift', 'Brave', 'Calm', 'Bold', 'Keen', 'Vast'];
const NICK_NOUN = ['Tiger', 'Eagle', 'Fox', 'Wolf', 'Bear', 'Hawk', 'Lynx', 'Otter', 'Panda', 'Raven'];

export function sanitizeNickname(input: string): string {
  const trimmed = input.trim().slice(0, NICK_MAX);
  return NICK_PATTERN.test(trimmed) ? trimmed : trimmed.replace(/[^a-zA-Z0-9 _-]/g, '');
}

export function generateRandomNickname(): string {
  const adj = NICK_ADJ[Math.floor(Math.random() * NICK_ADJ.length)];
  const noun = NICK_NOUN[Math.floor(Math.random() * NICK_NOUN.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${adj}${noun}${num}`;
}

export function getStoredNickname(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(NICK_KEY) ?? '';
}

export function setStoredNickname(nickname: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NICK_KEY, nickname);
}
