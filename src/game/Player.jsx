import { Trail } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CapsuleCollider, CoefficientCombineRule, RigidBody, useRapier } from '@react-three/rapier'
import { useMemo, useRef, useState } from 'react'
import { Quaternion, Vector3 } from 'three'

import { setWind, sfx } from './audio'
import { BodyAura } from './Aura'
import { emitPrint } from './auraPrints'
import {
  auraFor,
  BLOXITY_AVATAR,
  DASH_BOOST,
  DASH_COOLDOWN,
  DASH_TIME,
  JUMP_VELOCITY,
  MAX_RUN_SPEED,
  runSpeedForLevel,
  SPEED_LIMITS,
  TRAIL_BY_ID,
  WALLRUN_MAX_TIME,
} from './config'
import { getGame, useGameStore } from './gameStore'
import { LEVEL, spawnFor } from './level/buildWorld'
import {
  crusherState,
  meteorState,
  METEOR_FALL,
  now,
  oscPos,
  oscVel,
  pulseState,
  TOPPLE,
  toppleReady,
  toppleState,
} from './level/mechanics'
import { HALF } from './level/pieces'
import { purchase } from './monetization'
import PlayerAvatar from './PlayerAvatar'
import { flightPoint, pushFx, runtime } from './runtime'
import ShinobiModel from './shinobi/ShinobiModel'
import useKeyboard from './useKeyboard'

// Capsule roughly matching the humanoid. Rapier's capsule args are the half-height of
// the *cylindrical* section plus the radius, so total height = 2*(halfHeight+radius).
const CAPSULE_RADIUS = 0.35
const CAPSULE_HALF_HEIGHT = 0.55
const PLAYER_HEIGHT = 2 * (CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS)
const CENTER_TO_FEET = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS

/** Extra ray length past the capsule bottom; tolerates small ground gaps. */
const GROUND_RAY_SLACK = 0.15
/** Grace period after running off a ledge during which a ground jump still works. */
const COYOTE_TIME = 0.1
/** Below this the player has fallen out of the world. */
const KILL_Y = -12
/** Seconds a double-jump front flip takes. */
const FLIP_TIME = 0.5
/** How far to the side a wall can be and still be run on (the stage 2 walls lean out). */
const WALL_REACH = CAPSULE_RADIUS + 1.5
/** Horizontal speed that counts as a full-on sprint for the animation. */
const ANIM_FULL_SPEED = 24

// Scratch objects, reused each frame so the loop allocates nothing.
const _input = new Vector3()
const _move = new Vector3()
const _camForward = new Vector3()
const _camRight = new Vector3()
const _targetQuat = new Quaternion()
const _up = new Vector3(0, 1, 0)
const _tmp = new Vector3()
const _tangent = new Vector3()

const TRIGGERS_BY_WORLD = { 1: [], 2: [] }
for (const t of LEVEL.triggers) {
  TRIGGERS_BY_WORLD[t.min[0] > 500 ? 2 : 1].push(t)
}
const byWorld = (list) => {
  const out = { 1: [], 2: [] }
  for (const it of list) out[it.p[0] > 500 ? 2 : 1].push(it)
  return out
}
const HAZARDS_BY_WORLD = byWorld(LEVEL.hazards)
const TOPPLERS_BY_WORLD = byWorld(LEVEL.topplers)
const CRUSHERS_BY_WORLD = byWorld(LEVEL.crushers)
const GATES_BY_WORLD = byWorld(LEVEL.gates)

/** Hides the local aura while dead. */
const DEAD_REF = {
  get current() {
    return runtime.dead
  },
}

/** Seconds standing still on the water before you sink (Water Walk). */
const SINK_TIME = 1.2
/** Below this horizontal speed you count as standing still on water. */
const SINK_SPEED = 4
/** How close rubble must be to shield you from Shinra Tensei. */
const SHIELD_REACH = 4

const _hz = [0, 0, 0]
const _platVel = [0, 0, 0]
const _fp = [0, 0, 0]

function RainbowTrail() {
  const colors = ['#ff3040', '#ffa21f', '#ffe01f', '#3fe04a', '#2fa8ff', '#a24bff']
  return colors.map((color, i) => (
    <Trail key={color} width={0.35} length={7} color={color} attenuation={(w) => w}>
      <mesh position={[0, 0.7 + i * 0.12, -0.25]} visible={false}>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
      </mesh>
    </Trail>
  ))
}

function PlayerTrail({ id }) {
  const def = TRAIL_BY_ID[id]
  if (!def || id === 'none') return null
  if (def.color === 'rainbow') return <RainbowTrail />
  return (
    <Trail width={1.6} length={7} color={def.color} attenuation={(w) => w * w}>
      <mesh position={[0, 1, -0.2]} visible={false}>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
      </mesh>
    </Trail>
  )
}

/**
 * The player: a dynamic Rapier capsule driven by setting its velocity each frame.
 * All of the parkour lives here — speed-scaled running, double jump, dash, wall
 * running — plus trigger checks against the level description.
 */
export function Player({ onAvatarReady, bodyRef: externalBodyRef }) {
  const localBodyRef = useRef(null)
  const bodyRef = externalBodyRef || localBodyRef
  const visualRef = useRef(null)
  const tiltRef = useRef(null)
  const keys = useKeyboard()
  const { rapier, world } = useRapier()

  const equipped = useGameStore((s) => s.equipped)
  const trail = useGameStore((s) => s.trail)
  const auraId = useGameStore((s) => s.aura)
  const aura = useMemo(() => auraFor(equipped, auraId), [equipped, auraId])

  // Spawn where the saved progress says, evaluated once.
  const [spawnPos] = useState(() => {
    const g = getGame()
    return spawnFor(g.world, g.stage).pos
  })

  const st = useRef({
    jumpsUsed: 0,
    prevJump: false,
    prevDash: false,
    coyote: 0,
    jumpCooldown: 0,
    dashTime: 0,
    dashDir: new Vector3(0, 0, -1),
    airDashUsed: false,
    wallTime: 0,
    wallCooldown: 0,
    wallSide: 0,
    wallNormal: new Vector3(),
    stepCooldown: 0,
    yaw: Math.PI,
    inside: new Set(),
    buyCooldown: {},
    // Stage mechanics
    launch: null,
    boostTime: 0,
    boostSpeed: 0,
    sink: 0,
    knockTime: 0,
    knockX: 0,
    knockZ: 0,
    pulseSeen: null,
    // Feel
    stepPhase: 0,
    flipTime: 0,
    wasGrounded: true,
    lastWind: -1,
    printSide: 1,
    /** Flying Raijin leap in progress (see runtime.flight). */
    flight: null,
    /** Last frame's z, to catch running through a locked gate in one frame. */
    lastZ: null,
  })

  const motionRef = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: ANIM_FULL_SPEED })

  const castDown = (pos, body) => {
    const ray = new rapier.Ray({ x: pos.x, y: pos.y, z: pos.z }, { x: 0, y: -1, z: 0 })
    const max = CENTER_TO_FEET + GROUND_RAY_SLACK
    const hit = world.castRayAndGetNormal(ray, max, true, undefined, undefined, undefined, body)
    return hit && hit.normal.y > 0.5 ? hit : null
  }

  const castDir = (origin, dir, max, body) => {
    const ray = new rapier.Ray(origin, { x: dir.x, y: dir.y, z: dir.z })
    return world.castRayAndGetNormal(ray, max, true, undefined, undefined, undefined, body)
  }

  /** Trigger enter/stay handling. Triggers are plain AABBs from buildWorld. */
  const handleTriggers = (pos, grounded) => {
    const s = st.current
    const g = getGame()
    const list = TRIGGERS_BY_WORLD[g.world] || []
    const nowMs = performance.now()
    let wallZone = false
    let treadmill = 0
    let treadmillId = null
    let waterZone = false
    let shinra = null

    for (const t of list) {
      const inside =
        pos.x >= t.min[0] && pos.x <= t.max[0] &&
        pos.y >= t.min[1] && pos.y <= t.max[1] &&
        pos.z >= t.min[2] && pos.z <= t.max[2]
      const was = s.inside.has(t.id)
      if (!inside) {
        if (was) s.inside.delete(t.id)
        continue
      }
      const entered = !was
      if (entered) s.inside.add(t.id)

      switch (t.type) {
        case 'kill':
          if (t.data.lava) g.toast('Burned in the lava! Stay on the walls.', 'error')
          g.die()
          return { dead: true }
        case 'wallrun':
          wallZone = true
          break
        case 'checkpoint':
          // Locked gates keep under-levelled players out (see the gate check below).
          if ((t.data.req ?? 1) > g.level) break
          if (entered && g.stage !== t.data.stage) g.reachStage(t.data.world, t.data.stage)
          break
        case 'win':
          if (entered) g.claimStageWin(t.data.world, t.data.stage)
          break
        case 'pedestal':
          if (entered) {
            const def = t.data.def
            if (def.product && !g.owned[def.product]) purchase(def.product)
            else g.equip(def.id)
          }
          break
        case 'buyPad':
          if (entered && !g.owned[t.data.product] && nowMs > (s.buyCooldown[t.id] || 0)) {
            s.buyCooldown[t.id] = nowMs + 4000
            purchase(t.data.product)
          }
          break
        case 'treadmill': {
          const def = t.data.def
          const unlocked = def.product ? g.owned[def.product] : g.rebirths >= (def.rebirths || 0)
          if (unlocked) {
            if (grounded) {
              treadmill = def.mult
              treadmillId = def.id
            }
          } else if (entered && nowMs > (s.buyCooldown[t.id] || 0)) {
            s.buyCooldown[t.id] = nowMs + 4000
            if (def.product) purchase(def.product)
            else g.toast(`You need ${def.rebirths} Rebirth${def.rebirths === 1 ? '' : 's'} for this treadmill!`, 'error')
          }
          break
        }
        case 'chest':
          if (entered) g.claimChest()
          break
        case 'portal':
          if (entered) g.goToWorld(t.data.world)
          break
        case 'waterwalk':
          waterZone = true
          break
        case 'launch':
          if (entered) s.launch = t.data
          break
        case 'warp':
          if (entered && t.data.fly) {
            // Flying Raijin: leap along a high arc to the next kunai.
            const from = [pos.x, pos.y, pos.z]
            const to = t.data.to
            const dist = Math.hypot(to[0] - from[0], to[2] - from[2])
            s.flight = {
              from,
              to,
              peak: Math.max(from[1], to[1]) + 5 + dist * 0.12,
              start: performance.now(),
              dur: 1 + dist / 70,
            }
            runtime.flight = s.flight
            sfx('flash')
            sfx('whoosh')
            pushFx('dash', from)
            return { warped: true }
          }
          if (entered) {
            if (t.data.back) g.toast('Wrong portal! Look for the Sharingan.', 'error')
            runtime.teleport = { pos: t.data.to, yaw: 0 }
            sfx('portal')
            return { warped: true }
          }
          break
        case 'breakwall':
          if (s.dashTime > 0 && (runtime.broken.get(t.data.id) || 0) < now()) {
            runtime.broken.set(t.data.id, now() + 5)
            runtime.brokenAt.set(t.data.id, now())
            g.bigPopup('CHIDORI!', '#9fdcff')
            sfx('rebirth')
          }
          break
        case 'shinra':
          shinra = t.data
          break
        case 'topple':
          if (entered && toppleReady(runtime.topple.get(t.data.id), now())) runtime.topple.set(t.data.id, now())
          break
        default:
          break
      }
    }
    return { wallZone, treadmill, treadmillId, waterZone, shinra }
  }

  useFrame((state, rawDelta) => {
    const body = bodyRef.current
    if (!body) return
    // Same clamp scale as the physics step, so timers (dash, knockback) and the
    // velocities they drive stay in sync even at a low frame rate.
    const dt = Math.min(rawDelta, 0.25)
    const s = st.current
    const k = keys.current
    const motion = motionRef.current
    motion.time += dt

    // --- Teleports ----------------------------------------------------------
    if (runtime.teleport) {
      const { pos, yaw } = runtime.teleport
      runtime.teleport = null
      body.setTranslation({ x: pos[0], y: pos[1], z: pos[2] }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setGravityScale(1, true)
      s.inside.clear()
      s.jumpsUsed = 0
      s.dashTime = 0
      s.wallTime = 0
      s.boostTime = 0
      s.knockTime = 0
      s.launch = null
      s.sink = 0
      s.yaw = (yaw ?? 0) + Math.PI
      if (visualRef.current) visualRef.current.rotation.set(0, s.yaw, 0)
      s.flight = null
      s.lastZ = null
      runtime.flight = null
      if (tiltRef.current) tiltRef.current.rotation.set(0, 0, 0)
    }

    // --- Flying Raijin: carried along the arc, a front flip over the top, then land --
    if (s.flight && !runtime.dead) {
      const f = s.flight
      const u = Math.min(1, (performance.now() - f.start) / 1000 / f.dur)
      flightPoint(f, u, _fp)
      body.setTranslation({ x: _fp[0], y: _fp[1], z: _fp[2] }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setGravityScale(0, true)
      runtime.position[0] = _fp[0]
      runtime.position[1] = _fp[1]
      runtime.position[2] = _fp[2]
      s.yaw = Math.atan2(f.to[0] - f.from[0], f.to[2] - f.from[2])
      if (visualRef.current) {
        _targetQuat.setFromAxisAngle(_up, s.yaw)
        visualRef.current.quaternion.slerp(_targetQuat, 1 - Math.pow(0.0001, dt))
      }
      if (tiltRef.current) {
        const k = Math.min(1, Math.max(0, (u - 0.25) / 0.5))
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
        tiltRef.current.rotation.set(Math.PI * 2 * e, 0, 0)
      }
      motion.speed = ANIM_FULL_SPEED
      motion.grounded = false
      motion.wallrun = 0
      runtime.grounded = false
      runtime.yaw = s.yaw
      runtime.animSpeed = ANIM_FULL_SPEED
      runtime.speedRatio = 1
      if (u >= 1) {
        // Touch down softly on the island.
        s.flight = null
        s.jumpsUsed = 0
        s.flipTime = 0
        s.lastZ = null
        body.setGravityScale(1, true)
        if (tiltRef.current) tiltRef.current.rotation.set(0, 0, 0)
        const feet = [_fp[0], _fp[1] - CENTER_TO_FEET, _fp[2]]
        sfx('land')
        pushFx('land', feet)
        pushFx('jump', feet)
      }
      return
    }

    if (runtime.dead) {
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      body.setGravityScale(0, true)
      motion.speed = 0
      return
    }

    const g = getGame()
    const moveSpeed = runSpeedForLevel(g.level) * (SPEED_LIMITS[g.speedLimit] ?? 1)
    const maxJumps = 2

    s.jumpCooldown = Math.max(0, s.jumpCooldown - dt)
    s.wallCooldown = Math.max(0, s.wallCooldown - dt)
    s.stepCooldown = Math.max(0, s.stepCooldown - dt)
    runtime.dashCooldown = Math.max(0, runtime.dashCooldown - dt)

    const pos = body.translation()
    runtime.position[0] = pos.x
    runtime.position[1] = pos.y
    runtime.position[2] = pos.z

    const groundHit = castDown(pos, body)
    const grounded = Boolean(groundHit)
    // Standing on one of Gaara's moving sand rafts: ride along with it.
    const mover = groundHit ? runtime.moverByCollider.get(groundHit.collider.handle) : null
    const plat = mover ? oscVel(mover, now(), _platVel) : null
    if (grounded) {
      s.coyote = COYOTE_TIME
      if (s.jumpCooldown === 0) s.jumpsUsed = 0
      s.airDashUsed = false
      s.wallTime = 0
    } else {
      s.coyote = Math.max(0, s.coyote - dt)
    }

    // --- Triggers / out of world ----------------------------------------------
    const trig = handleTriggers(pos, grounded)
    if (runtime.dead || trig.dead || trig.warped) return
    const { wallZone, treadmill, treadmillId, waterZone, shinra } = trig

    // --- Locked stage gates: below the gate's level you simply can't get through ----
    for (const gt of GATES_BY_WORLD[g.world]) {
      if (gt.req <= g.level || Math.abs(pos.x - gt.p[0]) > HALF + 2 || pos.y > gt.p[1] + 16) continue
      const face = gt.p[2] + 0.5
      const crossed = s.lastZ !== null && s.lastZ >= face && pos.z < face
      if (crossed || (pos.z < face && pos.z > gt.p[2] - 3)) {
        pos.z = face + 0.1
        runtime.position[2] = pos.z
        body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true)
        const v = body.linvel()
        body.setLinvel({ x: v.x * 0.5, y: Math.min(v.y, 2), z: 7 }, true)
        s.dashTime = 0
        s.boostTime = 0
        s.knockTime = 0.15
        s.knockX = v.x * 0.5
        s.knockZ = 7
        g.gateLocked(gt.req, gt.stage)
      }
    }
    s.lastZ = pos.z
    runtime.treadmill = treadmill
    runtime.treadmillId = treadmillId
    if (pos.y < KILL_Y) {
      g.die()
      return
    }

    // --- Hazards: shuriken and meteors ------------------------------------------
    const t = now()
    for (const h of HAZARDS_BY_WORLD[g.world]) {
      if (Math.abs(h.p[2] - pos.z) > 25) continue
      let hit = false
      if (h.kind === 'shuriken') {
        oscPos(h, t, _hz)
        hit = Math.hypot(_hz[0] - pos.x, _hz[1] - pos.y, _hz[2] - pos.z) < h.r + 0.5
      } else if (h.kind === 'meteor') {
        // Lethal from just before impact until the crater stops glowing: a window wide
        // enough that a low frame rate can't skip it.
        const { u } = meteorState(h, t)
        hit = u > METEOR_FALL - 0.12 && u < METEOR_FALL + 0.25 && Math.hypot(h.p[0] - pos.x, h.p[2] - pos.z) < h.r + 0.4
      }
      if (hit) {
        g.toast(h.kind === 'meteor' ? 'Crushed by a meteor!' : 'Hit by a shuriken!', 'error')
        g.die()
        return
      }
    }

    // --- Falling walls and crushers ------------------------------------------------
    for (const tp of TOPPLERS_BY_WORLD[g.world]) {
      if (Math.abs(tp.p[2] - pos.z) > 20) continue
      const st = toppleState(runtime.topple.get(tp.id), t)
      // Lethal from mid-fall until just after it lands: wide enough that a low frame
      // rate can't step over it.
      if (st.since === undefined || st.since < TOPPLE.fall * 0.45 || st.since > TOPPLE.fall + 0.25) continue
      const xa = tp.p[0]
      const xb = tp.p[0] - tp.side * tp.h
      const inX = pos.x > Math.min(xa, xb) - 0.3 && pos.x < Math.max(xa, xb) + 0.3
      if (inX && Math.abs(pos.z - tp.p[2]) < tp.w / 2 + 0.5 && pos.y < 5) {
        g.toast('Crushed by a falling wall! Run past it or dodge aside.', 'error')
        g.die()
        return
      }
    }
    for (const c of CRUSHERS_BY_WORLD[g.world]) {
      if (Math.abs(c.p[2] - pos.z) > 8) continue
      if (!crusherState(c, t).lethal) continue
      if (
        Math.abs(pos.x - c.p[0]) < c.s[0] / 2 + 0.3 &&
        Math.abs(pos.z - c.p[2]) < c.s[2] / 2 + 0.3 &&
        pos.y < c.p[1] + c.s[1] + 2.5
      ) {
        g.toast('Squashed by a crusher! Watch its shadow.', 'error')
        g.die()
        return
      }
    }

    // --- Water Walk: keep moving or sink ------------------------------------------
    const lin0 = body.linvel()
    if (waterZone && grounded && !mover) {
      s.sink = Math.hypot(lin0.x, lin0.z) < SINK_SPEED ? s.sink + dt : Math.max(0, s.sink - dt * 2)
      if (s.sink > SINK_TIME) {
        s.sink = 0
        g.toast('You stopped and sank! Keep running on the water.', 'error')
        g.die()
        return
      }
    } else {
      s.sink = 0
    }

    // --- Shinra Tensei: a blast every few seconds, unless rubble shields you -------
    if (shinra) {
      const { index } = pulseState(shinra, t)
      if (s.pulseSeen !== null && index !== s.pulseSeen) {
        const [ox, oy, oz] = shinra.origin
        const dx = ox - pos.x
        const dy = oy - pos.y
        const dz = oz - pos.z
        const dist = Math.hypot(dx, dy, dz)
        // Only rubble right in front of you counts as cover.
        const cover = castDir({ x: pos.x, y: pos.y, z: pos.z }, { x: dx / dist, y: dy / dist, z: dz / dist }, SHIELD_REACH, body)
        if (!cover) {
          const flat = Math.hypot(dx, dz) || 1
          s.knockTime = 0.35
          s.knockX = (-dx / flat) * shinra.force
          s.knockZ = (-dz / flat) * shinra.force
          s.launch = { vy: 8, push: 0 }
          sfx('death')
        } else {
          g.toast('Shielded by the rubble!', 'good')
        }
      }
      s.pulseSeen = index
    } else {
      s.pulseSeen = null
    }

    // --- Input, relative to the camera's yaw -----------------------------------
    // With "A / D turn the camera" on, A and D steer the camera instead of strafing.
    const strafe = g.settings.adCamera ? 0 : (k.right ? 1 : 0) - (k.left ? 1 : 0)
    _input.set(
      strafe + runtime.touchMove.x,
      0,
      (k.backward ? 1 : 0) - (k.forward ? 1 : 0) - runtime.touchMove.y,
    )
    const hasInput = _input.lengthSq() > 0.01
    state.camera.getWorldDirection(_camForward)
    _camForward.y = 0
    _camForward.normalize()
    _camRight.crossVectors(_camForward, _up).normalize()
    _move.set(0, 0, 0)
    if (hasInput) {
      if (_input.lengthSq() > 1) _input.normalize()
      _move.addScaledVector(_camForward, -_input.z).addScaledVector(_camRight, _input.x)
    }

    const lin = body.linvel()
    let vx = lin.x
    let vy = lin.y
    let vz = lin.z

    // --- Dash (E) --------------------------------------------------------------
    const dashPressed = (k.dash && !s.prevDash) || runtime.dashRequest
    s.prevDash = k.dash
    runtime.dashRequest = false
    if (dashPressed && runtime.dashCooldown === 0 && (grounded || !s.airDashUsed)) {
      if (hasInput) s.dashDir.copy(_move).normalize()
      else s.dashDir.set(Math.sin(s.yaw), 0, Math.cos(s.yaw))
      s.dashTime = DASH_TIME
      runtime.dashCooldown = DASH_COOLDOWN
      if (!grounded) s.airDashUsed = true
      sfx('dash')
      sfx('whoosh')
      pushFx('dash', [pos.x, pos.y, pos.z])
    }

    // --- Wall run -----------------------------------------------------------------
    let wallrunning = false
    if (wallZone && !grounded && hasInput && s.wallCooldown === 0 && s.wallTime < WALLRUN_MAX_TIME && s.dashTime <= 0) {
      _tmp.crossVectors(_up, _move).normalize() // left of travel
      for (const side of [1, -1]) {
        const dir = { x: _tmp.x * side, y: 0, z: _tmp.z * side }
        const hit = castDir({ x: pos.x, y: pos.y, z: pos.z }, dir, WALL_REACH, body)
        if (hit && Math.abs(hit.normal.y) < 0.45) {
          wallrunning = true
          if (s.wallTime === 0) sfx('wall')
          s.wallSide = side
          s.wallNormal.set(hit.normal.x, 0, hit.normal.z).normalize()
          _tangent.crossVectors(_up, s.wallNormal).normalize()
          if (_tangent.dot(_move) < 0) _tangent.negate()
          const wallSpeed = Math.max(moveSpeed, 14)
          vx = _tangent.x * wallSpeed - s.wallNormal.x * 1.5
          vz = _tangent.z * wallSpeed - s.wallNormal.z * 1.5
          // A little hop onto the wall, then level running, then a slow slide.
          vy = s.wallTime < 0.2 ? Math.max(vy, 2) : s.wallTime < 3.2 ? 0 : -2
          s.wallTime += dt
          s.jumpsUsed = 1
          break
        }
      }
    }

    // --- Horizontal movement ----------------------------------------------------------
    if (s.knockTime > 0) {
      s.knockTime -= dt
      vx = s.knockX
      vz = s.knockZ
    } else if (s.dashTime > 0) {
      s.dashTime -= dt
      const dashSpeed = moveSpeed + DASH_BOOST
      vx = s.dashDir.x * dashSpeed
      vz = s.dashDir.z * dashSpeed
      vy = Math.max(vy, 0)
    } else if (!wallrunning) {
      const px = plat ? plat[0] : 0
      const pz = plat ? plat[2] : 0
      if (grounded) {
        if (hasInput) {
          vx = _move.x * moveSpeed + px
          vz = _move.z * moveSpeed + pz
        } else if (plat) {
          // Standing still on a raft: move exactly with it.
          vx = px
          vz = pz
        } else {
          const damp = Math.exp(-dt * 14)
          vx *= damp
          vz *= damp
        }
        if (plat && plat[1] > 0) vy = Math.max(vy, plat[1])
      } else if (hasInput) {
        // Strong air control, but no instant stop, so long jumps keep momentum.
        const a = 1 - Math.exp(-dt * 7)
        vx += (_move.x * moveSpeed - vx) * a
        vz += (_move.z * moveSpeed - vz) * a
      }
    }

    // --- Jumping (multi-jump) ----------------------------------------------------------
    const jumpPressed = (k.jump && !s.prevJump) || runtime.jumpRequest
    const jumpHeld = k.jump
    s.prevJump = k.jump
    runtime.jumpRequest = false
    if (jumpPressed || (jumpHeld && grounded && s.jumpCooldown === 0)) {
      if ((grounded || s.coyote > 0) && s.jumpCooldown === 0) {
        vy = JUMP_VELOCITY
        s.jumpsUsed = 1
        s.coyote = 0
        s.jumpCooldown = 0.2
        sfx('jump')
        pushFx('jump', [pos.x, pos.y - CENTER_TO_FEET, pos.z])
      } else if (wallrunning && jumpPressed && s.wallTime - dt < 0.3) {
        // Space pressed while leaping onto the wall: a boost up it, not a jump off it.
        vy = JUMP_VELOCITY * 0.8
      } else if (wallrunning && jumpPressed) {
        vy = JUMP_VELOCITY
        vx += s.wallNormal.x * 9
        vz += s.wallNormal.z * 9
        wallrunning = false
        s.wallCooldown = 0.3
        s.wallTime = 0
        s.jumpsUsed = 1
        sfx('jump')
      } else if (jumpPressed && s.jumpsUsed < maxJumps && !grounded) {
        vy = JUMP_VELOCITY
        s.jumpsUsed = Math.max(s.jumpsUsed, 1) + 1
        sfx('jump')
        sfx('whoosh')
        // Air jumps are a front flip, with a chakra ring kicked off under the feet.
        s.flipTime = FLIP_TIME
        pushFx('land', [pos.x, pos.y - CENTER_TO_FEET, pos.z])
      }
    }

    // --- Launch pads / toads (Leaf Hurricane) -------------------------------------
    if (s.launch) {
      vy = s.launch.vy
      if (s.launch.push) {
        s.boostTime = 1.6
        s.boostSpeed = s.launch.push
      }
      s.launch = null
      s.jumpsUsed = 1
      s.jumpCooldown = 0.25
      s.coyote = 0
      sfx('jump')
    }
    if (s.boostTime > 0) {
      // Keep flying forward (toward -Z, the course direction) at least this fast.
      s.boostTime = grounded && s.jumpCooldown === 0 ? 0 : s.boostTime - dt
      if (vz > -s.boostSpeed) vz = -s.boostSpeed
    }

    // Gravity off while wall running, so the scripted vertical speed holds between frames.
    body.setGravityScale(wallrunning ? 0 : 1, true)
    body.setLinvel({ x: vx, y: vy, z: vz }, true)

    // --- Step up small ledges (stairs, pedestal bases, treadmills) ---------------------
    if (grounded && hasInput && s.stepCooldown === 0) {
      const feet = pos.y - CENTER_TO_FEET
      _tmp.copy(_move).normalize()
      const reach = CAPSULE_RADIUS + 0.25
      const low = castDir({ x: pos.x, y: feet + 0.08, z: pos.z }, _tmp, reach, body)
      const high = castDir({ x: pos.x, y: feet + 0.62, z: pos.z }, _tmp, reach, body)
      if (low && !high && Math.abs(low.normal.y) < 0.5) {
        body.setTranslation({ x: pos.x + _tmp.x * 0.05, y: pos.y + 0.55, z: pos.z + _tmp.z * 0.05 }, true)
        s.stepCooldown = 0.12
      }
    }

    // --- Facing & visuals -----------------------------------------------------------------
    const horizontal = Math.hypot(vx, vz)
    if (wallrunning || s.dashTime > 0 || hasInput) {
      if (horizontal > 0.5) s.yaw = Math.atan2(vx, vz)
    } else if (treadmill > 0) {
      // Treadmill consoles are at the +X end: run toward them.
      s.yaw = Math.PI / 2
    }
    if (visualRef.current) {
      _targetQuat.setFromAxisAngle(_up, s.yaw)
      visualRef.current.quaternion.slerp(_targetQuat, 1 - Math.pow(0.0001, dt))
    }
    if (tiltRef.current) {
      const tilt = wallrunning ? s.wallSide * 0.7 : 0
      tiltRef.current.rotation.z += (tilt - tiltRef.current.rotation.z) * (1 - Math.exp(-dt * 12))
      // Front flip: one full turn, eased so it snaps round and settles upright.
      if (s.flipTime > 0) {
        s.flipTime = grounded || wallrunning ? 0 : Math.max(0, s.flipTime - dt)
        const k = 1 - s.flipTime / FLIP_TIME
        tiltRef.current.rotation.x = s.flipTime > 0 ? Math.PI * 2 * (1 - (1 - k) * (1 - k)) : 0
      }
    }

    // Speed only grows while actually running (or training on a treadmill).
    if (horizontal > 2 || treadmill > 0) runtime.lastMoveAt = performance.now()

    motion.speed = treadmill > 0 && horizontal < 2 ? ANIM_FULL_SPEED : horizontal
    motion.grounded = grounded || treadmill > 0
    runtime.grounded = grounded
    runtime.yaw = s.yaw
    runtime.animSpeed = motion.speed
    runtime.wallSide = motion.wallrun
    motion.maxSpeed = ANIM_FULL_SPEED
    motion.wallrun = wallrunning ? s.wallSide : 0
    motion.dashing = s.dashTime > 0
    motion.flying = false

    // --- Feel: footsteps, dust, landing thud, rushing wind -----------------------------
    const feet = [pos.x, pos.y - CENTER_TO_FEET, pos.z]
    const onTread = treadmill > 0
    if (((grounded || onTread) && (horizontal > 2 || onTread)) || wallrunning) {
      const r = Math.min(1, motion.speed / ANIM_FULL_SPEED)
      s.stepPhase += dt * (6 + r * 9)
      if (s.stepPhase >= Math.PI) {
        s.stepPhase -= Math.PI
        sfx('step')
        if (!onTread) pushFx('dust', feet)
        // Glowing footprints in the aura's colour.
        if (aura && grounded && !onTread && !wallrunning) {
          s.printSide = -s.printSide
          emitPrint(feet[0], feet[1], feet[2], s.yaw, s.printSide, aura.color)
        }
      }
    }
    // The collision has already zeroed this frame's fall speed, so use last frame's.
    const prevVy = s.prevVy ?? 0
    s.prevVy = lin.y
    if (grounded && !s.wasGrounded && Math.min(prevVy, lin.y) < -9) {
      sfx('land')
      pushFx('land', feet)
    }
    s.wasGrounded = grounded
    runtime.speedRatio = Math.min(1, (onTread ? MAX_RUN_SPEED * 0.6 : horizontal) / MAX_RUN_SPEED)
    const wind = Math.max(0, (runtime.speedRatio - 0.25) / 0.75)
    if (Math.abs(wind - s.lastWind) > 0.03) {
      s.lastWind = wind
      setWind(wind)
    }
  })

  return (
    <RigidBody
      ref={bodyRef}
      position={spawnPos}
      colliders={false}
      mass={1}
      enabledRotations={[false, false, false]}
      friction={0}
      linearDamping={0}
      ccd
      name="player"
    >
      {/* Min combine: the player never picks up floor friction, which would drag the
          set-each-frame velocity down between frames at a low frame rate. */}
      <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} friction={0} frictionCombineRule={CoefficientCombineRule.Min} />
      {/* Avatar origin is at the feet; the capsule origin is at its centre. */}
      <group ref={visualRef} position={[0, -PLAYER_HEIGHT / 2, 0]} rotation={[0, Math.PI, 0]}>
        <group ref={tiltRef} position={[0, 0.9, 0]}>
          <group position={[0, -0.9, 0]}>
            {equipped === BLOXITY_AVATAR ? (
              <PlayerAvatar onReady={onAvatarReady} targetHeight={PLAYER_HEIGHT} motionRef={motionRef} />
            ) : (
              <group scale={PLAYER_HEIGHT / 1.87}>
                <ShinobiModel id={equipped} motionRef={motionRef} onReady={onAvatarReady} />
              </group>
            )}
            <PlayerTrail id={trail} />
            {aura && <BodyAura aura={aura} motionRef={motionRef} hiddenRef={DEAD_REF} />}
          </group>
        </group>
      </group>
    </RigidBody>
  )
}

export { PLAYER_HEIGHT }
export default Player
