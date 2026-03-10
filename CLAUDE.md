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

**Game engine contract:**
```typescript
interface GameEngine<TState, TAction> {
  initialState(playerIds: string[], startingPlayerIndex?: number, config?: unknown): TState;
  applyAction(state: TState, action: TAction, ctx: ActionContext): TState;
  getStatus(state: TState): StatusResult;
  tick?(state: TState): TState;        // real-time games (Curve Fever)
  tickInterval?: number;               // ms between ticks
  simultaneousInput?: boolean;          // skip turn-order checks (RPS)
}
```

**Game config:** Per-game config (e.g., RPS mode, UNO rules) is passed via `create_room` event → stored as `room.gameConfig` → forwarded to `engine.initialState()` as third arg. Rematch preserves `gameConfig`.

**Provider stack** (layout.tsx, order matters): LanguageProvider → AuthProvider (Supabase) → ProgressionProvider → AchievementToastProvider → LevelUpToastProvider → PartyProvider → NicknameProvider.

**Rematch:** `room.rematchVotes` Set of player indices. One vote = request shown, two votes = auto-start new game with swapped starting player.

## Adding a New Multiplayer Game

1. `packages/shared/src/registry.ts` — add to `GameId` union
2. `packages/shared/src/games/<game>.ts` — define state, action, and player types
3. `packages/shared/src/protocol.ts` — extend `AnyGameState` / `AnyGameAction` unions
4. `packages/shared/src/index.ts` — re-export types (CJS-friendly: import with alias, re-export with `export const`)
5. `apps/ws/src/engines/<game>.ts` — implement `GameEngine<TState, TAction>` (store player-token UUID in `currentTurn`)
6. `apps/ws/src/engineRegistry.ts` — add one line mapping
7. `apps/web/src/components/games/<game>/` — implement component accepting `GameComponentProps`
8. `apps/web/src/lib/gameRegistry.ts` — add entry with manifest + Component
9. `apps/web/src/i18n/messages.ts` — add DE (required) and EN keys

Route auto-handled by `apps/web/src/app/games/[id]/page.tsx`. Singleplayer games get their own route under `apps/web/src/app/games/<name>/` and are listed in `SINGLEPLAYER_GAMES` array in `page.tsx`.

If the game needs per-room config: add config type to shared, extend `create_room` in `protocol.ts`, destructure in `apps/ws/src/index.ts` create_room handler, pass through `gameConfig` chain, and add config UI to lobby in the game component.

## i18n

German (`de`) is the default language. All strings in `apps/web/src/i18n/messages.ts` as `Record<Lang, Record<string, string>>`. `t(key)` falls back to English. No template interpolation — split keys and concatenate in JSX. Never shadow `t` with local variables. `t()` is only available inside components (not at module level).

## Current Games

**Multiplayer (8):** Tic-Tac-Toe, Connect 4, RPS (best-of / showdown modes), Chess (full rules + PGN export), Battleship (fog-of-war via state projection), Liar's Deck (2-6p bluffing), Curve Fever (2-6p real-time), UNO (2-4p, multi-round scoring + house rules).

**Singleplayer (8+):** Sudoku, Snake, Tetris, 2048, Pong, Breakout, Flappy, Minesweeper — each has its own route under `apps/web/src/app/games/<name>/`.

## Key Conventions

- Room codes: 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no ambiguous chars)
- Client sends only actions; server is authoritative
- WS URL resolution: `NEXT_PUBLIC_WS_URL` env → `window.location.hostname:3001` → `localhost:3001` (see `apps/web/src/lib/getWsUrl.ts`)
- Tailwind v4 with CSS-native config (no `tailwind.config.js`); design tokens via CSS custom properties (`--bg`, `--fg`, `--card`, etc.)
- Dark mode is default; use `var(--bg)`, `var(--card)` etc. for theme-sensitive surfaces
- `useMultiplayer` hook manages all Socket.IO state and phase flow: `lobby` → `waiting` → `playing` → `ended`
- Shared package exports must use CJS-compatible pattern: `import { Foo as _foo } from './games/foo'; export const Foo = _foo;`
- Spectators: joining a full room makes you a spectator (read-only, cannot send actions)
- Quick-play: per-GameId queue in `apps/ws/src/index.ts`; auto-matches into public rooms
- Admin panel at `/admin` (requires Supabase admin role); routes in `apps/web/src/app/admin/`

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
