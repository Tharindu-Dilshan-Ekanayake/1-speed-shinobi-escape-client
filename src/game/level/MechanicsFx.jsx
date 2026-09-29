import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, DoubleSide, Euler, Quaternion } from 'three'

import { sfx } from '../audio'
import { runtime } from '../runtime'
import { B, Ball } from '../shinobi/prims'
import {
  blinkActive,
  blinkTimeLeft,
  sinkTimeLeft,
  crusherState,
  meteorState,
  now,
  oscPos,
  pulseState,
  toppleState,
} from './mechanics'
import { getTexture } from './textures'

/* ------------------------------------------------------------------------ */
/* Gaara's moving sand rafts                                                 */
/* ------------------------------------------------------------------------ */

function BoatLook({ m }) {
  const [sx, sy, sz] = m.s
  const wood = '#9a5a2a'
  return (
    <>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial color={wood} roughness={0.85} />
      </mesh>
      {/* Pointed bow and stern, raised gunwales, a bench and a paper lantern. */}
      {[-1, 1].map((e) => (
        <mesh key={e} position={[e * (sx / 2 + 0.5), 0.1, 0]} rotation={[0, 0, e * -0.25]} castShadow>
          <boxGeometry args={[1.2, sy + 0.2, sz * 0.6]} />
          <meshStandardMaterial color="#7a4420" roughness={0.85} />
        </mesh>
      ))}
      {[-1, 1].map((e) => (
        <mesh key={`g${e}`} position={[0, sy / 2 + 0.15, e * (sz / 2 - 0.1)]}>
          <boxGeometry args={[sx + 0.4, 0.3, 0.2]} />
          <meshStandardMaterial color="#5a3014" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, sy / 2 + 0.1, 0]}>
        <boxGeometry args={[0.5, 0.2, sz - 0.4]} />
        <meshStandardMaterial color="#c89a5a" roughness={0.9} />
      </mesh>
      <mesh position={[sx / 2 - 0.4, sy / 2 + 1.1, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.8, 6]} />
        <meshStandardMaterial color="#3a2414" />
      </mesh>
      <mesh position={[sx / 2 - 0.4, sy / 2 + 1.9, 0]}>
        <sphereGeometry args={[0.3, 10, 8]} />
        <meshStandardMaterial color="#ff5a3a" emissive="#ff4a1a" emissiveIntensity={1.2} />
      </mesh>
    </>
  )
}

export function Mover({ m }) {
  const body = useRef(null)
  const collider = useRef(null)
  const pos = useMemo(() => [0, 0, 0], [])
  const map = useMemo(() => getTexture('sand', 2, 2), [])

  // Lets the player loop find this raft's velocity from the collider it stands on.
  useEffect(() => {
    const handle = collider.current?.handle
    if (handle === undefined) return undefined
    runtime.moverByCollider.set(handle, m)
    return () => runtime.moverByCollider.delete(handle)
  }, [m])

  const tilt = useRef(null)
  useFrame(({ clock }) => {
    const t = now()
    oscPos(m, t, pos)
    body.current?.setNextKinematicTranslation({ x: pos[0], y: pos[1], z: pos[2] })
    if (tilt.current && m.kind === 'boat') {
      // Bobs on the river, and rocks hard just before it sinks.
      const warn = sinkTimeLeft(m, t) < 1.2 ? 0.12 : 0.03
      tilt.current.rotation.z = Math.sin(clock.elapsedTime * (warn > 0.05 ? 14 : 1.6) + m.p[2]) * warn
    }
  })

  const [sx, sy, sz] = m.s
  if (m.kind === 'boat') {
    return (
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={m.p}>
        <CuboidCollider ref={collider} args={[sx / 2, sy / 2, sz / 2]} />
        <group ref={tilt}>
          <BoatLook m={m} />
        </group>
      </RigidBody>
    )
  }
  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={m.p}>
      <CuboidCollider ref={collider} args={[sx / 2, sy / 2, sz / 2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={m.s} />
        <meshStandardMaterial map={map} color={m.color} roughness={0.95} />
      </mesh>
      {/* Swirling sand under the raft */}
      <mesh position={[0, -sy / 2 - 0.4, 0]}>
        <coneGeometry args={[sx * 0.45, 1.6, 8, 1, true]} />
        <meshStandardMaterial color={m.color} transparent opacity={0.55} side={DoubleSide} depthWrite={false} />
      </mesh>
      <Sparkles count={12} scale={[sx, 1.5, sz]} position={[0, -0.6, 0]} size={4} color="#f3d9a0" speed={1.5} />
    </RigidBody>
  )
}

/* ------------------------------------------------------------------------ */
/* Itachi's genjutsu platforms                                               */
/* ------------------------------------------------------------------------ */

/** A stepping stone that sinks under the water for a moment now and then. */
function SinkingStone({ b }) {
  const collider = useRef(null)
  const look = useRef(null)
  useFrame(({ clock }) => {
    const t = now()
    const active = blinkActive(b, t)
    collider.current?.setEnabled(active)
    const left = blinkTimeLeft(b, t)
    const g = look.current
    if (!g) return
    const shake = active && left < 1 ? Math.sin(clock.elapsedTime * 50) * 0.06 : 0
    // Slides down under the water while inactive, back up just before it returns.
    const down = active ? 0 : Math.min(1, (b.off - left) / 0.3, left / 0.3)
    g.position.set(shake, -down * 2.2, shake * 0.6)
  })
  const [sx, sy, sz] = b.s
  return (
    <RigidBody type="fixed" colliders={false} position={b.p}>
      <CuboidCollider ref={collider} args={[sx / 2, sy / 2, sz / 2]} />
      <group ref={look}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[sx / 2, sx / 2 + 0.3, sy + 1.6, 9]} />
          <meshStandardMaterial color="#8d8f95" roughness={0.95} flatShading />
        </mesh>
        <mesh position={[0, (sy + 1.6) / 2 + 0.03, 0]}>
          <cylinderGeometry args={[sx / 2 - 0.1, sx / 2 - 0.1, 0.06, 9]} />
          <meshStandardMaterial color="#6fbf4a" roughness={1} flatShading />
        </mesh>
      </group>
    </RigidBody>
  )
}

export function Blinker({ b }) {
  if (b.kind === 'stone') return <SinkingStone b={b} />
  return <GenjutsuPlatform b={b} />
}

function GenjutsuPlatform({ b }) {
  const collider = useRef(null)
  const body = useRef(null)
  const top = useRef(null)
  useFrame(({ clock }) => {
    const t = now()
    const active = blinkActive(b, t)
    collider.current?.setEnabled(active)
    const warn = active && blinkTimeLeft(b, t) < 0.7
    const flicker = warn ? 0.45 + 0.45 * Math.abs(Math.sin(clock.elapsedTime * 18)) : 1
    if (body.current) {
      body.current.opacity = active ? flicker : 0.15
      body.current.depthWrite = active
    }
    if (top.current) top.current.emissiveIntensity = active ? 1.6 * flicker : 0.3
  })
  const [sx, sy, sz] = b.s
  return (
    <RigidBody type="fixed" colliders={false} position={b.p}>
      <CuboidCollider ref={collider} args={[sx / 2, sy / 2, sz / 2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={b.s} />
        <meshStandardMaterial ref={body} color="#2a0a10" roughness={0.6} transparent />
      </mesh>
      <mesh position={[0, sy / 2 + 0.02, 0]}>
        <boxGeometry args={[sx, 0.05, sz]} />
        <meshStandardMaterial ref={top} color="#ff2a3a" emissive="#ff1a2a" emissiveIntensity={1.4} transparent opacity={0.85} />
      </mesh>
    </RigidBody>
  )
}

/* ------------------------------------------------------------------------ */
/* Chidori walls                                                             */
/* ------------------------------------------------------------------------ */

const DEBRIS = Array.from({ length: 14 }, (_, i) => ({
  x: ((i * 37) % 22) - 11,
  y: ((i * 13) % 7) + 0.5,
  vx: (((i * 29) % 11) - 5) * 1.2,
  vy: 6 + ((i * 7) % 6),
  vz: -8 - ((i * 5) % 7),
  s: 0.8 + ((i * 3) % 4) * 0.35,
}))

export function Breakable({ w }) {
  const collider = useRef(null)
  const wall = useRef(null)
  const debris = useRef(null)
  const map = useMemo(() => getTexture('stone', w.s[0] / 4, w.s[1] / 4), [w.s])

  useFrame(() => {
    const t = now()
    const broken = (runtime.broken.get(w.id) || 0) > t
    collider.current?.setEnabled(!broken)
    if (wall.current) wall.current.visible = !broken
    if (!debris.current) return
    const age = t - (runtime.brokenAt.get(w.id) ?? -99)
    debris.current.visible = broken && age < 1.2
    if (!debris.current.visible) return
    debris.current.children.forEach((m, i) => {
      const d = DEBRIS[i]
      if (!d) return // the sparkles
      m.position.set(d.x + d.vx * age, d.y + d.vy * age - 15 * age * age, d.vz * age)
      m.rotation.set(age * 6 + i, age * 4, 0)
    })
  })

  const [sx, sy, sz] = w.s
  return (
    <>
      <RigidBody type="fixed" colliders={false} position={w.p}>
        <CuboidCollider ref={collider} args={[sx / 2, sy / 2, sz / 2]} />
      </RigidBody>
      <group position={w.p}>
      <group ref={wall}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={w.s} />
          <meshStandardMaterial map={map} color="#8d8680" roughness={0.9} />
        </mesh>
        {/* Glowing lightning cracks on the face */}
        {[-7, -2, 3, 8].map((x, i) => (
          <group key={x} position={[x, 0, sz / 2 + 0.03]}>
            {[0, 1, 2].map((j) => (
              <B key={j} p={[(j % 2 ? 0.5 : -0.5) + i * 0.1, -2.4 + j * 2.2, 0]} s={[0.18, 2.6, 0.05]} r={[0, 0, j % 2 ? 0.5 : -0.5]} c="#9fdcff" glow={2.2} />
            ))}
          </group>
        ))}
      </group>
      <group ref={debris} visible={false}>
        {DEBRIS.map((d, i) => (
          <mesh key={i} scale={d.s}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#8d8680" />
          </mesh>
        ))}
        <Sparkles count={30} scale={[20, 6, 4]} size={8} speed={3} color="#9fdcff" />
      </group>
      </group>
    </>
  )
}

/* ------------------------------------------------------------------------ */
/* Hazards: Tenten's shuriken, Madara's meteors                              */
/* ------------------------------------------------------------------------ */

function Shuriken({ h }) {
  const group = useRef(null)
  const spin = useRef(null)
  const pos = useMemo(() => [0, 0, 0], [])
  useFrame((_s, dt) => {
    oscPos(h, now(), pos)
    group.current?.position.set(pos[0], pos[1], pos[2])
    if (spin.current) spin.current.rotation.y += dt * 14
  })
  return (
    <group ref={group} position={h.p}>
      <group ref={spin} rotation={[0, 0, 0.15]}>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
            <mesh position={[0.95, 0, 0]} rotation={[0, 0.5, 0]} castShadow>
              <boxGeometry args={[1.9, 0.12, 0.7]} />
              <meshStandardMaterial color="#c9ced6" metalness={0.8} roughness={0.25} />
            </mesh>
            <mesh position={[1.75, 0, -0.25]} rotation={[0, 0.9, 0]}>
              <coneGeometry args={[0.3, 0.9, 4]} />
              <meshStandardMaterial color="#dfe4ea" metalness={0.8} roughness={0.2} />
            </mesh>
          </group>
        ))}
        <mesh>
          <cylinderGeometry args={[0.45, 0.45, 0.25, 12]} />
          <meshStandardMaterial color="#3a3d44" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}

function Meteor({ h }) {
  const rock = useRef(null)
  const mark = useRef(null)
  const markMat = useRef(null)
  const blast = useRef(null)
  useFrame(() => {
    const st = meteorState(h, now())
    if (rock.current) {
      rock.current.visible = st.falling
      rock.current.position.y = st.y
      rock.current.rotation.x += 0.1
    }
    if (mark.current) {
      const k = st.falling ? st.u / 1.1 : 0
      mark.current.visible = st.falling
      mark.current.scale.setScalar(0.4 + k * 0.6)
      if (markMat.current) markMat.current.opacity = 0.35 + k * 0.5
    }
    if (blast.current) {
      blast.current.visible = st.impact > 0
      blast.current.scale.setScalar(1 + (1 - st.impact) * 2)
      blast.current.material.opacity = st.impact * 0.8
    }
  })
  return (
    <group position={[h.p[0], 0, h.p[2]]}>
      <group ref={rock}>
        <mesh castShadow>
          <icosahedronGeometry args={[2.2, 0]} />
          <meshStandardMaterial color="#6a3a1a" emissive="#ff4a0a" emissiveIntensity={0.9} flatShading />
        </mesh>
        <mesh position={[0, 3.2, 0]}>
          <coneGeometry args={[1.9, 5, 10, 1, true]} />
          <meshBasicMaterial color="#ffa21f" transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={mark} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[h.r - 0.35, h.r, 32]} />
        <meshBasicMaterial ref={markMat} color="#ff2a1a" transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={blast} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <circleGeometry args={[h.r, 24]} />
        <meshBasicMaterial color="#ffb21a" transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Hazard({ h }) {
  if (h.kind === 'shuriken') return <Shuriken h={h} />
  if (h.kind === 'meteor') return <Meteor h={h} />
  return null
}

/* ------------------------------------------------------------------------ */
/* Pain's Shinra Tensei blast wave                                           */
/* ------------------------------------------------------------------------ */

export function PulseFx({ origin, period }) {
  const shell = useRef(null)
  const charge = useRef(null)
  useFrame(() => {
    const { u } = pulseState({ period }, now())
    if (shell.current) {
      const k = u / 0.22
      shell.current.visible = k < 1
      shell.current.scale.setScalar(1 + k * 55)
      shell.current.material.opacity = 0.45 * (1 - k)
    }
    if (charge.current) {
      const c = Math.max(0, (u - 0.7) / 0.3)
      charge.current.scale.setScalar(0.2 + c * 1.6)
      charge.current.material.opacity = c * 0.8
    }
  })
  return (
    <group position={origin}>
      <mesh ref={shell}>
        <sphereGeometry args={[1, 32, 20]} />
        <meshBasicMaterial color="#e6d8ff" transparent side={DoubleSide} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      <mesh ref={charge}>
        <sphereGeometry args={[1, 20, 14]} />
        <meshBasicMaterial color="#c9a8ff" transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------------ */
/* Falling walls                                                             */
/* ------------------------------------------------------------------------ */

const _tq = new Quaternion()
const _te = new Euler()

/** The look of a toppler, standing upright with its base at the origin. */
function ToppleLook({ kind, h, w, t }) {
  if (kind === 'pillar') {
    return (
      <>
        <B p={[0, h / 2, 0]} s={[t, h, w]} c="#c8231c" rough={0.6} />
        {[0.12, 0.5, 0.88].map((f) => (
          <B key={f} p={[0, h * f, 0]} s={[t + 0.12, 0.35, w + 0.12]} c="#e8b22a" metal={0.4} rough={0.4} />
        ))}
        <B p={[0, h + 0.3, 0]} s={[t + 0.9, 0.6, w + 0.9]} c="#2a1a1a" />
      </>
    )
  }
  if (kind === 'tree') {
    return (
      <>
        <B p={[0, h * 0.42, 0]} s={[t, h * 0.84, t]} c="#7a5230" rough={0.9} />
        <Ball p={[0, h * 0.88, 0]} s={[w * 0.55, h * 0.18, w * 0.55]} c="#3daa36" />
        <Ball p={[0, h * 0.72, 0.6]} s={[w * 0.45, h * 0.14, w * 0.4]} c="#4dbf40" />
      </>
    )
  }
  // A cracked temple wall panel: cream plaster, red frame, dark tiled top.
  return (
    <>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[t, h, w]} />
        <meshStandardMaterial map={getTexture('templeWall', w / 6, h / 6)} color="#ffffff" roughness={0.85} />
      </mesh>
      <B p={[0, h + 0.35, 0]} s={[t + 1, 0.7, w + 0.6]} c="#3a2a2a" />
      {[-1, 1].map((e) => (
        <B key={e} p={[0, h / 2, (e * w) / 2]} s={[t + 0.1, h, 0.6]} c="#c8231c" />
      ))}
    </>
  )
}

export function Toppler({ tp }) {
  const body = useRef(null)
  const look = useRef(null)
  const dust = useRef(null)
  const { h, w, t, side } = tp
  const lastPhase = useRef('idle')
  useFrame(({ clock }) => {
    const st = toppleState(runtime.topple.get(tp.id), now())
    if (st.phase !== lastPhase.current) {
      if (st.phase === 'shake') sfx('warn')
      if (st.phase === 'lie') sfx('crash')
      lastPhase.current = st.phase
    }
    // Falls toward the middle of the course: a wall on the left (side -1) tips to +x.
    const angle = side * st.k * (Math.PI / 2 - 0.08)
    _tq.setFromEuler(_te.set(0, 0, angle))
    body.current?.setNextKinematicRotation(_tq)
    if (look.current) {
      const shake = st.phase === 'shake' ? Math.sin(clock.elapsedTime * 60) * 0.06 : 0
      look.current.position.set(shake, 0, shake * 0.5)
    }
    if (dust.current) dust.current.visible = st.phase === 'lie' || st.phase === 'fall'
  })
  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={tp.p}>
        <CuboidCollider args={[t / 2, h / 2, w / 2]} position={[0, h / 2, 0]} />
        <group ref={look}>
          <ToppleLook kind={tp.kind} h={h} w={w} t={t} />
        </group>
      </RigidBody>
      <group ref={dust} position={[tp.p[0] - side * h * 0.5, 0.5, tp.p[2]]} visible={false}>
        <Sparkles count={30} scale={[h, 2, w + 2]} size={10} speed={0.8} color="#d8c8a8" />
      </group>
    </>
  )
}

/* ------------------------------------------------------------------------ */
/* Crushers                                                                  */
/* ------------------------------------------------------------------------ */

function CrusherFace({ sx, sy, sz, kind }) {
  const stone = kind === 'sand' ? '#d9ae6a' : '#8e8c88'
  const dark = kind === 'sand' ? '#8a5a2a' : '#3a3834'
  return (
    <>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial map={getTexture('stone', sx / 3, sy / 3)} color={stone} roughness={0.9} />
      </mesh>
      {/* Iron bands and an angry carved face on both sides it can be seen from. */}
      {[-0.32, 0.32].map((f) => (
        <B key={f} p={[0, sy * f, 0]} s={[sx + 0.1, 0.3, sz + 0.1]} c="#3a3d44" metal={0.6} rough={0.4} />
      ))}
      {[1, -1].map((face) => (
        <group key={face} position={[0, 0, (face * sz) / 2 + face * 0.03]} rotation={[0, face > 0 ? 0 : Math.PI, 0]}>
          <B p={[-sx * 0.22, sy * 0.1, 0]} s={[sx * 0.2, sy * 0.1, 0.05]} r={[0, 0, -0.35]} c={dark} />
          <B p={[sx * 0.22, sy * 0.1, 0]} s={[sx * 0.2, sy * 0.1, 0.05]} r={[0, 0, 0.35]} c={dark} />
          <B p={[-sx * 0.22, -sy * 0.02, 0.01]} s={[sx * 0.1, sy * 0.1, 0.05]} c="#ff3a1a" glow={1.4} />
          <B p={[sx * 0.22, -sy * 0.02, 0.01]} s={[sx * 0.1, sy * 0.1, 0.05]} c="#ff3a1a" glow={1.4} />
          <B p={[0, -sy * 0.22, 0]} s={[sx * 0.5, sy * 0.08, 0.05]} c={dark} />
        </group>
      ))}
    </>
  )
}

export function Crusher({ c }) {
  const body = useRef(null)
  const look = useRef(null)
  const shadow = useRef(null)
  const [sx, sy, sz] = c.s
  const baseY = c.p[1] + sy / 2
  const lastLift = useRef(1)
  useFrame(({ clock }) => {
    const st = crusherState(c, now())
    // Thud when it lands, if the player is close enough to hear it.
    if (st.lift === 0 && lastLift.current > 0 && Math.abs(runtime.position[2] - c.p[2]) < 30) sfx('crash')
    lastLift.current = st.lift
    const y = baseY + st.lift * c.drop
    body.current?.setNextKinematicTranslation({ x: c.p[0], y, z: c.p[2] })
    if (look.current) {
      const shake = st.warn ? Math.sin(clock.elapsedTime * 70) * 0.08 : 0
      look.current.position.set(shake, 0, 0)
    }
    if (shadow.current) {
      // The shadow darkens as the block comes down: the warning to get out.
      shadow.current.material.opacity = 0.15 + (1 - st.lift) * 0.4 + (st.warn ? 0.2 : 0)
      shadow.current.material.color.set(st.warn ? '#ff2a1a' : '#000000')
    }
  })
  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[c.p[0], baseY + c.drop, c.p[2]]}>
        <CuboidCollider args={[sx / 2, sy / 2, sz / 2]} />
        <group ref={look}>
          <CrusherFace sx={sx} sy={sy} sz={sz} kind={c.kind} />
        </group>
        {/* Chain up into the sky */}
        <B p={[0, sy / 2 + 6, 0]} s={[0.3, 12, 0.3]} c="#3a3d44" metal={0.6} />
      </RigidBody>
      <mesh ref={shadow} position={[c.p[0], c.p[1] + 0.06, c.p[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[sx + 0.6, sz + 0.6]} />
        <meshBasicMaterial color="#000" transparent opacity={0.2} depthWrite={false} />
      </mesh>
    </>
  )
}
