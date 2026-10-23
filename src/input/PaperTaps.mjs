export const DOUBLE_TAP_MS = 450;
export const DOUBLE_TAP_DISTANCE_PX = 24;

/** A pair must hit the same paper, nearby, without an intervening drag. */
export class PaperTaps {
  previous = null;
  tap(id, x, y, now) {
    const prior = this.previous;
    const double = prior && prior.id === id && now - prior.time <= DOUBLE_TAP_MS &&
      Math.hypot(x - prior.x, y - prior.y) <= DOUBLE_TAP_DISTANCE_PX;
    this.previous = double ? null : { id, x, y, time: now };
    return Boolean(double);
  }
  reset() { this.previous = null; }
}
