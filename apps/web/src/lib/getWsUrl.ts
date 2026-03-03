/**
 * Resolves the WebSocket server base URL.
 *
 * Priority:
 *  1. NEXT_PUBLIC_WS_URL env var — always set this on Vercel (production).
 *  2. Browser runtime: derived from window.location — works for localhost and
 *     LAN access (phone/other device on same network) without any config.
 *  3. SSR hard fallback 'http://localhost:3001' — only reached during
 *     server-side render when the env var is absent; never used in production
 *     if NEXT_PUBLIC_WS_URL is correctly configured on Vercel.
 */
export function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'https' : 'http';
    return `${proto}://${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
}
