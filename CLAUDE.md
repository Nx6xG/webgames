# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install              # install all workspace dependencies
pnpm dev                  # build shared, then start ws (:3001) + web (:3000) concurrently
pnpm build                # pnpm -r build (recursive, topological order)
pnpm type-check           # tsc --noEmit for ws and web

pnpm --filter web dev     # next dev
pnpm --filter ws dev      # tsx watch src/index.ts
pnpm --filter shared build # tsc → dist/ (CJS) — must run before ws/web
```

No test runner is configured.

## Architecture

Monorepo (pnpm workspaces): `apps/web` (Next.js 15 App Router + Tailwind v4), `apps/ws` (Socket.IO 4 server), `packages/shared` (TypeScript types, CJS dist).

**TypeScript path resolution:** `apps/web` tsconfig paths point `shared` → `src/index.ts` (type-checking via bundler); `apps/ws` points `shared` → `dist/index` (runtime CJS). Never add `"type": "module"` to `packages/shared/package.json`.

**Multiplayer flow:** Client connects via Socket.IO → `identify` with `wg_player_token` (localStorage) → `create_room`/`join_room`/`quick_play` → server creates room, calls `engine.initialState()` → game actions validated by `engine.applyAction()` → `game_state` broadcast (per-socket projection for Battleship secrecy). 30s reconnect grace period, 60s idle room cleanup, 120s for empty public rooms.

**Server sanity guard:** Before every `game_action`, the server checks `connectedTokens.has(state.currentTurn)`. ALL game engines MUST store a player-token UUID in `currentTurn` — never a short slot ID like `'A'`/`'B'`.

**State projection:** `apps/ws/src/stateProjection.ts` — `projectGameState()` filters state per-socket before emission (e.g., strips opponent ship positions in Battleship).

## Adding a New Multiplayer Game

1. `packages/shared/src/registry.ts` — add to `GameId` union
2. `packages/shared/src/protocol.ts` — extend `AnyGameState` / `AnyGameAction` unions
3. `apps/ws/src/engines/<game>.ts` — implement `GameEngine<TState, TAction>` (store player-token UUID in `currentTurn`)
4. `apps/ws/src/engineRegistry.ts` — add one line mapping
5. `apps/web/src/components/games/<game>/` — implement component accepting `GameComponentProps`
6. `apps/web/src/lib/gameRegistry.ts` — add entry with manifest + Component

Route auto-handled by `apps/web/src/app/games/[id]/page.tsx`. Singleplayer games get their own route under `apps/web/src/app/games/<name>/` and are listed in `SINGLEPLAYER_GAMES` array in `page.tsx`.

## i18n

German (`de`) is the default language. All strings in `apps/web/src/i18n/messages.ts` as `Record<Lang, Record<string, string>>`. `t(key)` falls back to English. No template interpolation — split keys and concatenate in JSX. Never shadow `t` with local variables. `t()` is only available inside components (not at module level).

## Key Conventions

- Room codes: 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no ambiguous chars)
- Client sends only actions; server is authoritative
- WS URL resolution: `NEXT_PUBLIC_WS_URL` env → `window.location.hostname:3001` → `localhost:3001` (see `apps/web/src/lib/getWsUrl.ts`)
- Tailwind v4 with CSS-native config (no `tailwind.config.js`); design tokens via CSS custom properties (`--bg`, `--fg`, `--card`, etc.)
- Dark mode is default; use `var(--bg)`, `var(--card)` etc. for theme-sensitive surfaces
- `useMultiplayer` hook manages all Socket.IO state and phase flow: `lobby` → `waiting` → `playing` → `ended`

## Environment Variables

| Variable | Package | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_WS_URL` | web | (empty → auto) | WebSocket server URL |
| `PORT` | ws | `3001` | WS server port |
| `WS_CORS_ORIGIN` | ws | `http://localhost:3000` | Allowed CORS origin |

## Deploy (Render)

- WS build: `pnpm install --frozen-lockfile && pnpm --filter shared build && pnpm --filter ws build`
- WS start: `pnpm --filter ws start`
- `dist/` is gitignored — must be built on deploy
