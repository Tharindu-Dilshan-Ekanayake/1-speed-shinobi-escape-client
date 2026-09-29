/**
 * Mutable per-frame state shared between the physics loop, the HUD and the store.
 *
 * Deliberately not React state: the player loop writes most of this 60 times a
 * second, and nothing should re-render because of it. The HUD sets the request
 * flags (dash, jump) and the player loop consumes them.
 */
export const runtime = {
  /** Pending teleport, consumed by the player loop: { pos: [x,y,z], yaw } */
  teleport: null,
  /** When set, the follow camera snaps to this yaw (radians) once. */
  cameraYaw: null,
  /** performance.now() of the last frame the player was running (or training). */
  lastMoveAt: 0,
  /** Multiplier of the treadmill currently stood on, 0 when not on one. */
  treadmill: 0,
  /** Id of the treadmill currently stood on (drives its effects), null otherwise. */
  treadmillId: null,
  dead: false,
  /** Player is standing on something (drives the running-path glow). */
  grounded: false,
  /** Facing, animation speed and wall-run side, shared with the other players. */
  yaw: 0,
  animSpeed: 0,
  wallSide: 0,
  /**
   * Flying Raijin leap in progress (stage 10): { from, to, peak, start (ms), dur (s) }.
   * Kept after landing until the next one so the streak can fade out.
   */
  flight: null,
  /** performance.now() of the last level-up (drives the glow around the player). */
  levelUpFx: 0,
  dashRequest: false,
  jumpRequest: false,
  /** Seconds until dash is ready again; the HUD greys the button out meanwhile. */
  dashCooldown: 0,
  /** Held by the on-screen mobile buttons. */
  touchMove: { x: 0, y: 0 },
  /** Latest player position, for anything that wants it without touching Rapier. */
  position: [0, 0, 0],
  /** Collider handle -> moving-platform data, so the player can ride Gaara's sand. */
  moverByCollider: new Map(),
  /** Chidori walls: id -> time (s, see level/mechanics now()) until which it stays broken. */
  broken: new Map(),
  brokenAt: new Map(),
  /** Falling walls: id -> time (s) it was triggered. */
  topple: new Map(),
  /** Set on a stage win: trophies rain around the player. { at: ms, amount } */
  winRain: null,
  /** performance.now() of the last rebirth, for its burst effect. */
  rebirthFx: 0,
  /** Recent one-shot visual effects: { id, type, p, at }. Use pushFx() to add. */
  fx: [],
  fxSeq: 0,
  /** 0..1 how close to top speed the player is running; drives effects and FOV. */
  speedRatio: 0,
  /** The follow camera's { yaw, pitch, distance }, set by FollowCamera. */
  orbit: null,
}

/** Queues a one-shot effect for RunFx (dust, landing ring, dash burst...). */
export function pushFx(type, p) {
  runtime.fxSeq += 1
  runtime.fx.push({ id: runtime.fxSeq, type, p, at: performance.now() / 1000 })
  if (runtime.fx.length > 40) runtime.fx.splice(0, runtime.fx.length - 40)
}

/** Point `u` (0..1) along a Flying Raijin arc, eased so it launches and lands softly. */
export function flightPoint(f, u, out) {
  const e = 0.5 - Math.cos(Math.PI * Math.min(Math.max(u, 0), 1)) / 2
  const a = 1 - e
  const [ax, ay, az] = f.from
  const [bx, by, bz] = f.to
  // Quadratic curve whose middle rises to about `peak`.
  const cy = 2 * f.peak - (ay + by) / 2
  out[0] = ax + (bx - ax) * e
  out[1] = a * a * ay + 2 * a * e * cy + e * e * by
  out[2] = az + (bz - az) * e
  return out
}
