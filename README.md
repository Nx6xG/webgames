# Web Games Platform

A production-ready multiplayer web games platform featuring real-time WebSocket gameplay.

## Architecture

```
webgames/
├── apps/
│   ├── web/          # Next.js 15 App Router + TypeScript + Tailwind
│   └── ws/           # Node.js Socket.IO WebSocket server
└── packages/
    └── shared/       # Shared TypeScript types (protocol, manifests, engine)
```

## Games

- **Tic-Tac-Toe** — Classic 3×3 grid, real-time online multiplayer via room codes

## Prerequisites

- Node.js 20+
- pnpm 9+

## Setup

```bash
# Install all dependencies
pnpm install

# Copy environment files
cp apps/web/.env.local.example apps/web/.env.local
```

## Development

```bash
# Start both servers (WebSocket on :3001, Next.js on :3000)
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Production Build

```bash
pnpm build

# Start both servers
pnpm start
```

## Environment Variables

### apps/web/.env.local

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_WS_URL` | `http://localhost:3001` | WebSocket server URL |

### apps/ws (optional)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | WebSocket server port |
| `WEB_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |

## How Multiplayer Works

1. Player A clicks **Create Room** → server returns a 6-char room code (e.g. `A3BX9Z`)
2. Player A shares the invite link or the room code with Player B
3. Player B enters the code and clicks **Join Room**
4. Both players are now in the same room; the game starts immediately
5. Moves are sent as actions to the authoritative server which validates and broadcasts updated state
6. If a player disconnects, the remaining player is notified

## Plugin Architecture (Future Games)

To add a new game:
1. Add a `GameManifest` entry to `packages/shared/src/manifests.ts`
2. Implement `GameEngine<TState, TAction>` in `apps/ws/src/engines/`
3. Add UI component in `apps/web/src/components/games/`
4. Add route at `apps/web/src/app/games/[slug]/`
