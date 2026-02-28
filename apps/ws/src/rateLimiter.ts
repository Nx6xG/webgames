/** Minimum milliseconds between accepted actions per socket */
const MIN_INTERVAL_MS = 300;

class ActionRateLimiter {
  private readonly last = new Map<string, number>();

  /**
   * Returns true and records the timestamp if the action is allowed.
   * Returns false (without updating) if the cooldown has not elapsed.
   */
  check(socketId: string): boolean {
    const now = Date.now();
    const prev = this.last.get(socketId) ?? 0;
    if (now - prev < MIN_INTERVAL_MS) return false;
    this.last.set(socketId, now);
    return true;
  }

  clear(socketId: string): void {
    this.last.delete(socketId);
  }
}

export const rateLimiter = new ActionRateLimiter();
