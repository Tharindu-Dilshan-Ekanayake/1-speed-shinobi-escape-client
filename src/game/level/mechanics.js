/**
 * Time-driven stage mechanics, as pure functions of a shared clock.
 *
 * The visuals (Level.jsx) and the rules (Player.jsx) both evaluate these with the
 * same `now()`, so a meteor is lethal exactly where it is drawn and a genjutsu
 * platform is solid exactly while it looks solid — no messages between them.
 */

/** Seconds, shared by every mechanic. */
export const now = () => performance.now() / 1000

/**
 * Sine oscillation used by moving platforms and sliding hazards.
 * `m`: { p: base [x,y,z], a: amplitude [x,y,z], w: rad/s, ph: phase }
 */
export function oscPos(m, t, out = [0, 0, 0]) {
  const k = Math.sin(m.w * t + m.ph)
  out[0] = m.p[0] + m.a[0] * k
  out[1] = m.p[1] + m.a[1] * k + sinkOffset(m, t)
  out[2] = m.p[2] + m.a[2] * k
  return out
}

export function oscVel(m, t, out = [0, 0, 0]) {
  const k = m.w * Math.cos(m.w * t + m.ph)
  out[0] = m.a[0] * k
  out[1] = m.a[1] * k + (sinkOffset(m, t + 0.02) - sinkOffset(m, t)) / 0.02
  out[2] = m.a[2] * k
  return out
}

/**
 * Sinking boats (Stage 11): `m.sink` = { period, ph, down, depth }. For `down`
 * seconds of every `period` the boat dips `depth` units under the water, then comes
 * back up. Anyone standing on it goes into the river.
 */
export const SINK_EASE = 0.45

export function sinkOffset(m, t) {
  const s = m.sink
  if (!s) return 0
  const u = (((t + s.ph) % s.period) + s.period) % s.period
  const start = s.period - s.down
  if (u < start) return 0
  const v = u - start
  const e = Math.min(1, v / SINK_EASE, (s.down - v) / SINK_EASE)
  return -s.depth * Math.max(0, e)
}

/** Seconds until a boat starts sinking (for the warning wobble); Infinity if it never does. */
export function sinkTimeLeft(m, t) {
  const s = m.sink
  if (!s) return Infinity
  const u = (((t + s.ph) % s.period) + s.period) % s.period
  const start = s.period - s.down
  return u < start ? start - u : 0
}

/**
 * Disappearing platforms. Genjutsu ones come in two groups that take turns being
 * real. With `off` set (Stage 8 stones) a platform is there most of the time and
 * sinks away for `off` seconds of every `period`.
 */
export function blinkActive(b, t) {
  if (b.off) return (((t + (b.ph || 0)) % b.period) + b.period) % b.period < b.period - b.off
  return Math.floor(t / b.period) % 2 === b.group
}

/** Seconds until a platform flips; used for the warning flicker. */
export function blinkTimeLeft(b, t) {
  if (b.off) {
    const u = (((t + (b.ph || 0)) % b.period) + b.period) % b.period
    return u < b.period - b.off ? b.period - b.off - u : b.period - u
  }
  return b.period - (t % b.period)
}

/** Seconds a meteor spends falling from the sky. */
export const METEOR_FALL = 1.1
export const METEOR_HEIGHT = 45

/**
 * Meteor state for Madara's stage: `{ y, falling, impact }`. `u` runs 0..period;
 * the meteor falls for METEOR_FALL seconds, then the crater glows briefly.
 */
export function meteorState(m, t) {
  const u = (((t + m.ph) % m.period) + m.period) % m.period
  if (u < METEOR_FALL) {
    return { y: METEOR_HEIGHT * (1 - u / METEOR_FALL) + 1, falling: true, impact: 0, u }
  }
  return { y: -50, falling: false, impact: Math.max(0, 1 - (u - METEOR_FALL) / 0.5), u }
}

/** Pain's Shinra Tensei: index of the current blast, and how far into it we are. */
export function pulseState(p, t) {
  return { index: Math.floor(t / p.period), u: (t % p.period) / p.period }
}

/* ------------------------------------------------------------------------ */
/* Falling walls ("topplers")                                                */
/* ------------------------------------------------------------------------ */

/**
 * A wall at the side of the course that shakes, then crashes across the path when
 * the player runs past its trigger. It lies there as an obstacle, then rises again.
 * Seconds per phase:
 */
export const TOPPLE = { shake: 0.6, fall: 0.45, lie: 4, rise: 1.2 }
const TOPPLE_TOTAL = TOPPLE.shake + TOPPLE.fall + TOPPLE.lie + TOPPLE.rise

/**
 * `t0` = when it was triggered (or undefined). Returns
 * `{ phase, k }` with k = how far it has fallen, 0 (standing) .. 1 (flat).
 */
export function toppleState(t0, t) {
  if (t0 === undefined) return { phase: 'idle', k: 0 }
  let u = t - t0
  if (u < 0 || u >= TOPPLE_TOTAL) return { phase: 'idle', k: 0 }
  if (u < TOPPLE.shake) return { phase: 'shake', k: 0, u }
  u -= TOPPLE.shake
  // `since` = seconds since it started falling; the lethal window is measured on it.
  if (u < TOPPLE.fall) {
    const f = u / TOPPLE.fall
    return { phase: 'fall', k: f * f, since: u }
  }
  u -= TOPPLE.fall
  if (u < TOPPLE.lie) return { phase: 'lie', k: 1, since: u + TOPPLE.fall }
  u -= TOPPLE.lie
  const r = u / TOPPLE.rise
  return { phase: 'rise', k: 1 - r * r * (3 - 2 * r) }
}

export function toppleReady(t0, t) {
  return t0 === undefined || t - t0 >= TOPPLE_TOTAL
}

/* ------------------------------------------------------------------------ */
/* Crushers: stone blocks that slam down and slowly rise again               */
/* ------------------------------------------------------------------------ */

const CRUSH_FALL = 0.2
const CRUSH_DOWN = 0.55
const CRUSH_RISE = 0.9
const CRUSH_WARN = 0.5

/**
 * `c`: { period, ph, drop }. Returns
 *   lift   - 0 (slammed down) .. 1 (fully up)
 *   warn   - true while it shakes just before falling
 *   lethal - true from just before impact until shortly after
 */
export function crusherState(c, t) {
  const u = (((t + c.ph) % c.period) + c.period) % c.period
  const fallAt = c.period - CRUSH_FALL - CRUSH_DOWN - CRUSH_RISE
  let lift = 1
  if (u >= fallAt) {
    const v = u - fallAt
    if (v < CRUSH_FALL) lift = 1 - (v / CRUSH_FALL) ** 2
    else if (v < CRUSH_FALL + CRUSH_DOWN) lift = 0
    else lift = (v - CRUSH_FALL - CRUSH_DOWN) / CRUSH_RISE
  }
  return {
    lift,
    warn: u >= fallAt - CRUSH_WARN && u < fallAt,
    lethal: u >= fallAt + CRUSH_FALL * 0.4 && u < fallAt + CRUSH_FALL + 0.2,
  }
}
