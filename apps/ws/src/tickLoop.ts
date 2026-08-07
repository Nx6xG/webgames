import type { GameServer } from './serverTypes.js';
import { roomManager } from './rooms.js';
import { engineRegistry } from './engineRegistry.js';
import { emitGameState } from './emit.js';

// ── Tick loop management (real-time games like Curve Fever) ──────────────────

const tickTimers = new Map<string, ReturnType<typeof setInterval>>();

export function startTickLoop(io: GameServer, roomCode: string) {
  if (tickTimers.has(roomCode)) return; // already running
  const room = roomManager.getRoom(roomCode);
  if (!room?.state) return;
  const engine = engineRegistry[room.gameId];
  if (!engine.tick || !engine.tickInterval) return;

  const interval = setInterval(() => {
    const r = roomManager.getRoom(roomCode);
    if (!r?.state) { stopTickLoop(roomCode); return; }
    let newState;
    try {
      newState = engine.tick!(r.state);
    } catch (err) {
      console.error(`[tick error] room=${r.code} game=${r.gameId}:`, err);
      return; // skip this tick, don't crash
    }
    // Skip emit if state reference didn't change (no timeout occurred)
    if (newState !== r.state) {
      r.state = newState;
      emitGameState(io, r, newState);
    }
    const st = engine.getStatus(newState);
    if (st.status !== 'ongoing') {
      stopTickLoop(roomCode);
    }
  }, engine.tickInterval);

  tickTimers.set(roomCode, interval);
}

export function stopTickLoop(roomCode: string) {
  const timer = tickTimers.get(roomCode);
  if (timer) { clearInterval(timer); tickTimers.delete(roomCode); }
}
