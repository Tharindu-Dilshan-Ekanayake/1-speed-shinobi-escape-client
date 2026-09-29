import { Billboard, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  IcosahedronGeometry,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
} from 'three'

import { CHARACTER_BY_ID, FX_NAMES, PRODUCTS } from '../config'
import { fmt, fmtTime } from '../format'
import { useGameStore } from '../gameStore'
import { runtime } from '../runtime'
import { useBake } from '../shinobi/bake'
import { B, Cyl, mat } from '../shinobi/prims'
import ShinobiModel from '../shinobi/ShinobiModel'
import { drawBoard, loadBoardFont, makeBoardTexture } from './boardCanvas'
import { Label } from './Label'
import { getTexture } from './textures'

/* ------------------------------------------------------------------------ */
/* Trees and bushes (instanced: there are hundreds of them)                  */
/* ------------------------------------------------------------------------ */

const TRUNK_GEO = new CylinderGeometry(0.26, 0.42, 1, 7)
const BLOB_GEO = new IcosahedronGeometry(1, 1)
const TRUNK_MAT = new MeshStandardMaterial({ color: '#7a5230', roughness: 0.9, flatShading: true })
const LEAF_MAT = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true })
const PALETTES = {
  green: ['#3daa36', '#4dbf40', '#34a03a', '#5ccb47', '#2f9431'],
  sakura: ['#ffb3d1', '#ff9ac2', '#ffc6dd', '#ff8ab8', '#ffd3e6'],
  autumn: ['#e8742a', '#f2a23a', '#d9542a', '#f6c24a', '#c8421f'],
}
const LEAF_COLORS = Object.fromEntries(Object.entries(PALETTES).map(([k, v]) => [k, v.map((c) => new Color(c))]))

/** Leaf blobs of one tree, relative to its base: [x, y, z, radius]. */
const TREE_BLOBS = [
  [0, 4.2, 0, 2.5],
  [1.3, 5.3, 0.5, 1.8],
  [-1.2, 5.1, -0.6, 1.9],
  [0.2, 6.7, -0.1, 1.6],
  [-0.4, 5.2, 1.3, 1.5],
]
const BUSH_BLOBS = [
  [0, 0.75, 0, 1.15],
  [0.9, 0.6, 0.3, 0.85],
  [-0.8, 0.55, -0.2, 0.8],
]

const _obj = new Object3D()

export function Forest({ trees, bushes }) {
  const trunks = useRef(null)
  const leaves = useRef(null)

  const blobs = useMemo(() => {
    const out = []
    const add = (base, s, list, seed, pal = 'green') => {
      const colors = LEAF_COLORS[pal] ?? LEAF_COLORS.green
      list.forEach(([x, y, z, r], i) =>
        out.push({ p: [base[0] + x * s, base[1] + y * s, base[2] + z * s], r: r * s, c: colors[(seed + i) % colors.length] }),
      )
    }
    trees.forEach((t, i) => add(t.p, t.s, TREE_BLOBS, i * 3, t.pal))
    bushes.forEach((b, i) => add(b.p, b.s, BUSH_BLOBS, i))
    return out
  }, [trees, bushes])

  useLayoutEffect(() => {
    trees.forEach((t, i) => {
      _obj.position.set(t.p[0], t.p[1] + 1.8 * t.s, t.p[2])
      _obj.scale.set(t.s, 3.6 * t.s, t.s)
      _obj.rotation.set(0, 0, 0)
      _obj.updateMatrix()
      trunks.current.setMatrixAt(i, _obj.matrix)
    })
    trunks.current.instanceMatrix.needsUpdate = true
    blobs.forEach((b, i) => {
      _obj.position.set(...b.p)
      _obj.scale.setScalar(b.r)
      _obj.rotation.set(i * 0.7, i * 1.3, 0)
      _obj.updateMatrix()
      leaves.current.setMatrixAt(i, _obj.matrix)
      leaves.current.setColorAt(i, b.c)
    })
    leaves.current.instanceMatrix.needsUpdate = true
    if (leaves.current.instanceColor) leaves.current.instanceColor.needsUpdate = true
  }, [trees, blobs])

  return (
    <>
      <instancedMesh ref={trunks} args={[TRUNK_GEO, TRUNK_MAT, Math.max(1, trees.length)]} castShadow />
      <instancedMesh ref={leaves} args={[BLOB_GEO, LEAF_MAT, Math.max(1, blobs.length)]} castShadow receiveShadow />
    </>
  )
}

/* ------------------------------------------------------------------------ */
/* Bunting: ropes of little flags strung across the streets                  */
/* ------------------------------------------------------------------------ */

const FLAG_GEO = new ConeGeometry(0.42, 0.9, 3)
const ROPE_GEO = new BoxGeometry(1, 0.05, 0.05)
const FLAG_MAT = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, side: DoubleSide })
const ROPE_MAT = new MeshStandardMaterial({ color: '#3a2a1a', roughness: 1 })
const FLAG_COLORS = ['#f2e6c8', '#f08a2a', '#d8412e', '#f2c230', '#ffffff'].map((c) => new Color(c))
const FLAG_SPACING = 1.3
const SAG = 1.4

export function Bunting({ ropes }) {
  const flags = useRef(null)
  const lines = useRef(null)
  const count = useMemo(
    () => ropes.reduce((n, r) => n + Math.floor((r.x1 - r.x0) / FLAG_SPACING), 0),
    [ropes],
  )
  useLayoutEffect(() => {
    let i = 0
    ropes.forEach((r, ri) => {
      const len = r.x1 - r.x0
      const n = Math.floor(len / FLAG_SPACING)
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n
        _obj.position.set(r.x0 + t * len, r.y - SAG * 4 * t * (1 - t) - 0.45, r.z)
        _obj.rotation.set(Math.PI, (k % 2) * 0.1, 0)
        _obj.scale.set(1, 1, 0.12)
        _obj.updateMatrix()
        flags.current.setMatrixAt(i, _obj.matrix)
        flags.current.setColorAt(i, FLAG_COLORS[(k + ri) % FLAG_COLORS.length])
        i += 1
      }
      // The rope, as two straight halves meeting at the sag point.
      for (const half of [0, 1]) {
        const xa = r.x0 + half * len * 0.5
        const ya = half ? r.y - SAG : r.y
        const yb = half ? r.y : r.y - SAG
        const dx = len * 0.5
        const dy = yb - ya
        _obj.position.set(xa + dx / 2, (ya + yb) / 2, r.z)
        _obj.rotation.set(0, 0, Math.atan2(dy, dx))
        _obj.scale.set(Math.hypot(dx, dy), 1, 1)
        _obj.updateMatrix()
        lines.current.setMatrixAt(ri * 2 + half, _obj.matrix)
      }
    })
    flags.current.instanceMatrix.needsUpdate = true
    if (flags.current.instanceColor) flags.current.instanceColor.needsUpdate = true
    lines.current.instanceMatrix.needsUpdate = true
  }, [ropes])
  return (
    <>
      <instancedMesh ref={flags} args={[FLAG_GEO, FLAG_MAT, Math.max(1, count)]} frustumCulled={false} />
      <instancedMesh ref={lines} args={[ROPE_GEO, ROPE_MAT, Math.max(1, ropes.length * 2)]} frustumCulled={false} />
    </>
  )
}

/* ------------------------------------------------------------------------ */
/* Shared glow decal                                                         */
/* ------------------------------------------------------------------------ */

export function GroundGlow({ color, size = 6, opacity = 0.55, y = 0.03 }) {
  const map = useMemo(() => getTexture('glow'), [])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} renderOrder={2}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={map} color={color} transparent opacity={opacity} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
    </mesh>
  )
}

/** Shop price in wins, as a gold 3D label. */
function WinsTag({ price, y, size = 0.7 }) {
  return <Label text={`${fmt(price)} Wins`} p={[0, y, 0]} size={size} color="#ffd21f" outline="#3a2400" />
}

/* ------------------------------------------------------------------------ */
/* Character pedestals                                                       */
/* ------------------------------------------------------------------------ */

/** 3000 -> "3.0k", like the original's requirement labels. */
function fmtReq(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}m`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const PEDESTAL_STYLES = {
  red: { side: '#b3141d', top: '#ff3340', glow: '#ff2a3a' },
  gold: { side: '#c9870f', top: '#ffd23a', glow: '#ffb81f' },
  equipped: { side: '#1f9c3a', top: '#54ff6a', glow: '#3dff5a' },
}

/** Spinning light ring, soft light column and rising sparks around a pedestal. */
function PedestalAura({ color, strong }) {
  const ring = useRef(null)
  const column = useRef(null)
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    if (ring.current) {
      ring.current.rotation.z += dt * 0.9
      ring.current.scale.setScalar(1 + Math.sin(t * 2.4) * 0.05)
    }
    if (column.current) column.current.material.opacity = (strong ? 0.2 : 0.12) + Math.sin(t * 2) * 0.04
  })
  return (
    <>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.42, 0]}>
        <ringGeometry args={[1.7, 1.95, 40, 1, 0, Math.PI * 1.6]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={column} position={[0, 2.4, 0]}>
        <cylinderGeometry args={[1.5, 1.7, 4, 24, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.14} side={DoubleSide} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <Sparkles count={strong ? 26 : 14} scale={[3, 3.8, 3]} position={[0, 1.9, 0]} size={strong ? 6 : 4} color={color} speed={0.6} />
    </>
  )
}

export function Pedestal({ id, p, yaw, style = 'red' }) {
  const def = CHARACTER_BY_ID[id]
  const equipped = useGameStore((s) => s.equipped === id)
  const unlocked = useGameStore((s) => (def.product ? Boolean(s.owned[def.product]) : s.unlocked.includes(id) || s.wins >= def.wins))
  const big = Boolean(def.product) && PRODUCTS[def.product].price >= 25000
  const phase = useMemo(() => (p[0] * 13 + p[2] * 7) % 10, [p])
  const st = PEDESTAL_STYLES[equipped ? 'equipped' : style]

  let status = null
  if (equipped) status = { text: 'Equipped', color: '#3dff5a' }
  else if (!def.product && !unlocked) status = { text: `${fmtReq(def.wins)} Wins Required`, color: '#ffe23a' }
  else if (unlocked) status = { text: 'Touch to Equip', color: '#ffffff' }

  const top = 0.42 + (big ? 2.4 : 2.0)
  return (
    <group position={p}>
      {/* Slab: dark bevel, bright glowing top. */}
      <B p={[0, 0.17, 0]} s={[3.4, 0.34, 3.4]} c={st.side} rough={0.5} />
      <B p={[0, 0.36, 0]} s={[3.1, 0.06, 3.1]} c={st.top} glow={1.6} rough={0.4} />
      <GroundGlow color={st.glow} size={6.5} opacity={0.5} y={0.05} />

      <group position={[0, 0.39, 0]} rotation={[0, yaw, 0]} scale={big ? 1.25 : 1.05}>
        <ShinobiModel id={id} phase={phase} posed />
      </group>
      <PedestalAura color={def.color} strong={big || style === 'gold' || equipped} />

      <Billboard position={[0, top, 0]}>
        <Label text={def.name} p={[0, 1.4, 0]} size={0.78} color={def.color} outline="#2a1206" />
        <Label text={FX_NAMES[def.fx]} p={[0, 0.72, 0]} size={0.6} color="#ffffff" outline="#1a1a1a" />
        {def.product && !unlocked ? (
          <WinsTag price={PRODUCTS[def.product].price} y={0.14} size={0.5} />
        ) : (
          status && <Label text={status.text} p={[0, 0.16, 0]} size={0.46} color={status.color} outline="#1a1a1a" />
        )}
      </Billboard>
    </group>
  )
}

/* ------------------------------------------------------------------------ */
/* Treadmills (belt along +X, console at the +X end)                         */
/* ------------------------------------------------------------------------ */

function TreadmillFx({ def }) {
  const group = useRef(null)
  const streaks = useRef([])
  useFrame((_s, dt) => {
    const active = runtime.treadmillId === def.id
    if (group.current) group.current.visible = active
    if (!active) return
    streaks.current.forEach((m, i) => {
      if (!m) return
      m.position.x -= dt * (14 + i * 2)
      if (m.position.x < -4) m.position.x = 3 + (i % 3)
    })
  })
  return (
    <group ref={group} visible={false}>
      <Sparkles count={40} scale={[7, 3, 4]} position={[0, 1.6, 0]} size={7} speed={2} color={def.color} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh
          key={i}
          ref={(m) => (streaks.current[i] = m)}
          position={[i - 2, 0.8 + (i % 3) * 0.6, (i % 2 ? 1 : -1) * (0.9 + (i % 3) * 0.3)]}
        >
          <boxGeometry args={[1.6, 0.05, 0.05]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.7} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

const FIRE_TREADMILLS = ['x1.5', 'x4', 'x10', 'train2']
const FLAMES = 7
const BOLTS = 5

/** Flames licking up both rails. */
function TreadmillFire({ color, power }) {
  const refs = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      const f = 0.75 + Math.sin(t * 13 + i * 1.7) * 0.18 + Math.sin(t * 29 + i) * 0.1
      m.scale.set(power.current, f * power.current * 1.3, power.current)
      m.material.opacity = 0.55 + Math.sin(t * 17 + i * 2.3) * 0.2
    })
  })
  const flames = []
  for (const side of [-1, 1]) {
    for (let i = 0; i < FLAMES; i++) {
      flames.push({ key: `${side}${i}`, p: [-3.2 + i * 1.05, 0.9, side * 1.95], hot: i % 2 === 0 })
    }
  }
  return (
    <>
      {flames.map((f, i) => (
        <mesh key={f.key} ref={(m) => (refs.current[i] = m)} position={f.p}>
          <coneGeometry args={[0.3, 1.3, 6]} />
          <meshBasicMaterial
            color={f.hot ? '#ffd23a' : color}
            transparent
            opacity={0.7}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
      <Sparkles count={26} scale={[7, 2.6, 4.4]} position={[0, 1.5, 0]} size={6} speed={2.2} color="#ffb13a" />
    </>
  )
}

/** Crackling lightning bolts jumping along the belt. */
function TreadmillBolts({ color, power }) {
  const refs = useRef([])
  const next = useRef(0)
  useFrame(({ clock }) => {
    if (clock.elapsedTime < next.current) return
    next.current = clock.elapsedTime + 0.07
    refs.current.forEach((g, i) => {
      if (!g) return
      g.visible = Math.random() < 0.55 + power.current * 0.25
      if (!g.visible) return
      const x = -3.2 + Math.random() * 6.4
      const side = i % 2 ? 1 : -1
      g.position.set(x, 0.45, side * (0.4 + Math.random() * 1.4))
      g.children.forEach((seg, j) => {
        seg.position.set((Math.random() - 0.5) * 0.35, 0.3 + j * 0.45, (Math.random() - 0.5) * 0.35)
        seg.rotation.set((Math.random() - 0.5) * 1.4, 0, (Math.random() - 0.5) * 1.4)
      })
      g.scale.setScalar(power.current)
    })
  })
  return (
    <>
      {Array.from({ length: BOLTS }, (_, i) => (
        <group key={i} ref={(g) => (refs.current[i] = g)}>
          {[0, 1, 2].map((j) => (
            <mesh key={j}>
              <boxGeometry args={[0.07, 0.55, 0.07]} />
              <meshBasicMaterial color={j === 1 ? '#ffffff' : color} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
      <Sparkles count={22} scale={[7, 2.4, 4.4]} position={[0, 1.4, 0]} size={5} speed={3} color={color} />
    </>
  )
}

/** Neon arch over the belt and a spinning emblem, pulsing faster while in use. */
function TreadmillArch({ def, power }) {
  const mats = useRef([])
  const emblem = useRef(null)
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const p = power.current
    mats.current.forEach((m, i) => {
      if (m) m.emissiveIntensity = 0.8 + p * (0.8 + Math.sin(t * (3 + p * 4) + i) * 0.5)
    })
    if (emblem.current) {
      emblem.current.rotation.y += dt * (0.8 + p * 2.5)
      emblem.current.position.y = 5.2 + Math.sin(t * 2) * 0.15
    }
  })
  return (
    <>
      {[-1, 1].map((side, i) => (
        <mesh key={side} position={[-3.6, 1.9, side * 2.15]}>
          <boxGeometry args={[0.22, 3.8, 0.22]} />
          <meshStandardMaterial ref={(m) => (mats.current[i] = m)} color={def.color} emissive={def.color} emissiveIntensity={1.2} />
        </mesh>
      ))}
      <mesh position={[-3.6, 3.8, 0]}>
        <boxGeometry args={[0.22, 0.22, 4.52]} />
        <meshStandardMaterial ref={(m) => (mats.current[2] = m)} color={def.color} emissive={def.color} emissiveIntensity={1.2} />
      </mesh>
      <group ref={emblem} position={[0, 5.2, 0]}>
        <mesh>
          <torusGeometry args={[0.7, 0.09, 8, 28]} />
          <meshStandardMaterial ref={(m) => (mats.current[3] = m)} color={def.color} emissive={def.color} emissiveIntensity={1.4} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.55, 0.55, 0.12]} />
          <meshStandardMaterial color="#ffffff" emissive={def.color} emissiveIntensity={0.8} />
        </mesh>
      </group>
    </>
  )
}

function TreadmillEnergy({ def, unlocked }) {
  const power = useRef(0.8)
  useFrame((_s, dt) => {
    const target = !unlocked ? 0.55 : runtime.treadmillId === def.id ? 1.4 : 0.9
    power.current += (target - power.current) * (1 - Math.exp(-dt * 5))
  })
  return (
    <>
      <TreadmillArch def={def} power={power} />
      {FIRE_TREADMILLS.includes(def.id) ? (
        <TreadmillFire color={def.color} power={power} />
      ) : (
        <TreadmillBolts color={def.color} power={power} />
      )}
    </>
  )
}

export function Treadmill({ def, p }) {
  const belt = useMemo(() => getTexture('belt', 5, 1), [])
  const chevrons = useMemo(() => getTexture('chevron', 3, 1), [])
  const beltMat = useRef(null)
  const chevMat = useRef(null)
  const unlocked = useGameStore((s) => (def.product ? Boolean(s.owned[def.product]) : s.rebirths >= (def.rebirths || 0)))
  const speedFactor = 0.6 + Math.log2(def.mult + 1) * 0.5

  useFrame((_s, dt) => {
    if (!unlocked) return
    if (beltMat.current?.map) beltMat.current.map.offset.x += dt * speedFactor
    if (chevMat.current?.map) chevMat.current.map.offset.x += dt * speedFactor * 0.6
  })

  const color = def.color
  const locked = !unlocked
  let sub = def.sub
  if (def.product && locked) sub = null

  return (
    <group position={p}>
      {/* Frame + belt */}
      <B p={[0, 0.14, 0]} s={[7.6, 0.28, 4.4]} c="#454a56" rough={0.5} />
      <mesh position={[-0.1, 0.29, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[7, 3.4]} />
        <meshStandardMaterial ref={beltMat} map={belt} color="#5a5f6b" roughness={0.9} />
      </mesh>
      <mesh position={[-0.1, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[7, 2]} />
        <meshStandardMaterial
          ref={chevMat}
          map={chevrons}
          color={color}
          emissive={color}
          emissiveIntensity={locked ? 0.6 : 1.4}
          transparent
          alphaTest={0.3}
          depthWrite={false}
        />
      </mesh>
      {/* Glowing side rails */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <B p={[0, 0.34, side * 1.95]} s={[7.6, 0.14, 0.3]} c={color} glow={locked ? 0.8 : 1.8} />
          <B p={[3.4, 1.2, side * 1.95]} s={[0.18, 1.8, 0.18]} c="#c9ced6" metal={0.6} rough={0.3} />
        </group>
      ))}
      {/* Handlebar + console */}
      <B p={[3.4, 2.1, 0]} s={[0.2, 0.2, 4.1]} c="#c9ced6" metal={0.6} rough={0.3} />
      <B p={[4.6, 1.2, 0]} s={[1, 2.4, 3.6]} c="#d8dce4" rough={0.5} />
      <B p={[4.2, 2.5, 0]} s={[0.25, 0.9, 3.2]} r={[0, 0, 0.35]} c="#15171c" />
      <B p={[4.1, 2.5, 0]} s={[0.05, 0.7, 2.9]} r={[0, 0, 0.35]} c={color} glow={locked ? 0.2 : 1.2} />

      {/* Sign above the console, readable from the lobby */}
      <group position={[4.7, 4.3, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <B p={[0, 0, -0.1]} s={[5.2, 1.9, 0.15]} c="#15171c" />
        <B p={[0, 0.98, -0.1]} s={[5.3, 0.1, 0.18]} c={color} glow={1.5} />
        <B p={[0, -0.98, -0.1]} s={[5.3, 0.1, 0.18]} c={color} glow={1.5} />
        <Label text={def.label} p={[0, sub || def.product ? 0.3 : 0, 0.05]} size={0.72} color={color} outline="#0a0a0a" />
        {sub && <Label text={sub} p={[0, -0.45, 0.05]} size={0.4} color="#ffffff" outline="#0a0a0a" />}
        {def.product && locked && (
          <group position={[0, -0.45, 0.05]}>
            <WinsTag price={PRODUCTS[def.product].price} y={0} size={0.42} />
          </group>
        )}
      </group>

      <GroundGlow color={color} size={9} opacity={locked ? 0.18 : 0.38} y={0.31} />
      <TreadmillEnergy def={def} unlocked={!locked} />
      <TreadmillFx def={def} />
    </group>
  )
}

/* ------------------------------------------------------------------------ */
/* Pads: end-of-stage squares and the lobby jump pads                        */
/* ------------------------------------------------------------------------ */

const ARROW_COUNT = 8

export function RisingArrows({ radius = 2 }) {
  const refs = useRef([])
  const offsets = useMemo(
    () =>
      Array.from({ length: ARROW_COUNT }, (_, i) => ({
        a: (i / ARROW_COUNT) * Math.PI * 2 + (i % 2) * 0.3,
        r: radius * (0.55 + ((i * 37) % 10) / 22),
        phase: (i * 0.37) % 1,
      })),
    [radius],
  )
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.55
    offsets.forEach((o, i) => {
      const m = refs.current[i]
      if (!m) return
      const k = (t + o.phase) % 1
      m.position.set(Math.cos(o.a) * o.r, 0.4 + k * 4.2, Math.sin(o.a) * o.r)
      const s = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1
      m.scale.setScalar(Math.max(0.001, s))
    })
  })
  return offsets.map((_, i) => (
    <group key={i} ref={(m) => (refs.current[i] = m)}>
      <mesh position={[0, 0.2, 0]}>
        <coneGeometry args={[0.32, 0.38, 4]} />
        <meshStandardMaterial color="#7dff3a" emissive="#5aff1f" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[0.16, 0.3, 0.16]} />
        <meshStandardMaterial color="#7dff3a" emissive="#5aff1f" emissiveIntensity={1.4} />
      </mesh>
    </group>
  ))
}

export function Pad({ p, size, color, kind }) {
  const ref = useRef(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.material.emissiveIntensity = 1 + Math.sin(clock.elapsedTime * 4) * 0.35
  })
  return (
    <group position={p}>
      <B p={[0, 0.05, 0]} s={[size[0] + 0.4, 0.1, size[1] + 0.4]} c="#1a1a1a" />
      <mesh ref={ref} position={[0, 0.14, 0]}>
        <boxGeometry args={[size[0], 0.1, size[1]]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} />
      </mesh>
      <GroundGlow color={color} size={size[0] * 1.8} opacity={0.4} y={0.2} />
      {kind === 'win' && <Sparkles count={16} scale={[size[0], 2, size[1]]} position={[0, 1, 0]} size={5} color="#fff27a" speed={1} />}
    </group>
  )
}

/* ------------------------------------------------------------------------ */
/* Free chest                                                                */
/* ------------------------------------------------------------------------ */

export function Chest({ p }) {
  const chestAt = useGameStore((s) => s.chestAt)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const ready = now >= chestAt
  return (
    <group position={p}>
      <B p={[0, 0.6, 0]} s={[2.4, 1.2, 1.6]} c="#8b5a2b" />
      <B p={[0, 1.35, 0]} s={[2.5, 0.4, 1.7]} c="#a8702f" />
      <B p={[0, 0.6, 0]} s={[2.45, 0.2, 1.65]} c="#ffc21f" metal={0.6} rough={0.3} />
      <B p={[0, 1.0, 0.82]} s={[0.35, 0.45, 0.1]} c="#ffc21f" metal={0.6} rough={0.3} />
      {ready && (
        <>
          <Sparkles count={24} scale={[3, 2, 3]} position={[0, 1.5, 0]} size={6} color="#ffe23a" />
          <GroundGlow color="#ffd21f" size={6} opacity={0.5} />
        </>
      )}
      <Billboard position={[0, 3, 0]}>
        <Label text="Free Chest" p={[0, 0.5, 0]} size={0.8} color="#ff4fd8" outline="#2a0a2a" />
        <Label
          text={ready ? 'Touch to Claim!' : fmtTime((chestAt - now) / 1000)}
          p={[0, -0.25, 0]}
          size={0.5}
          color={ready ? '#3dff5a' : '#ffffff'}
          outline="#1a1a1a"
        />
      </Billboard>
    </group>
  )
}

/* ------------------------------------------------------------------------ */
/* Leaderboards                                                              */
/* ------------------------------------------------------------------------ */

/** `p[1]` lifts the board; its posts always reach down to the ground. */
const BULBS = 26

/** Marquee bulbs chasing round the board's frame. */
function BoardBulbs({ color }) {
  const refs = useRef([])
  const spots = useMemo(() => {
    const out = []
    const w = 13.6
    const h = 12.2
    const per = (w + h) * 2
    for (let i = 0; i < BULBS; i++) {
      let d = (i / BULBS) * per
      let x
      let y
      if (d < w) [x, y] = [-w / 2 + d, h / 2]
      else if ((d -= w) < h) [x, y] = [w / 2, h / 2 - d]
      else if ((d -= h) < w) [x, y] = [w / 2 - d, -h / 2]
      else [x, y] = [-w / 2, -h / 2 + (d - w)]
      out.push([x, y + 6.3, 0.32])
    }
    return out
  }, [])
  useFrame(({ clock }) => {
    const head = Math.floor(clock.elapsedTime * 8) % BULBS
    refs.current.forEach((m, i) => {
      if (!m) return
      const lit = (i - head + BULBS) % 6 < 3
      m.material.emissiveIntensity = lit ? 2.2 : 0.3
    })
  })
  return spots.map((p, i) => (
    <mesh key={i} ref={(m) => (refs.current[i] = m)} position={p}>
      <sphereGeometry args={[0.16, 8, 6]} />
      <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={1} />
    </mesh>
  ))
}

/** Gold crown floating over the title. */
function Crown() {
  const ref = useRef(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.8) * 0.5
    ref.current.position.y = 15.1 + Math.sin(clock.elapsedTime * 2) * 0.12
  })
  return (
    <group ref={ref} position={[0, 15.1, 0.3]}>
      <mesh>
        <cylinderGeometry args={[0.75, 0.8, 0.45, 12, 1, true]} />
        <meshStandardMaterial color="#ffd21f" emissive="#ffb000" emissiveIntensity={0.6} metalness={0.6} roughness={0.3} side={DoubleSide} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.72, 0.42, Math.sin(a) * 0.72]}>
            <coneGeometry args={[0.16, 0.45, 4]} />
            <meshStandardMaterial color="#ffd21f" emissive="#ffb000" emissiveIntensity={0.6} metalness={0.6} roughness={0.3} />
          </mesh>
        )
      })}
      <mesh position={[0, 0, 0.78]}>
        <sphereGeometry args={[0.13, 10, 8]} />
        <meshStandardMaterial color="#ff2a4a" emissive="#ff1a3a" emissiveIntensity={1.4} />
      </mesh>
    </group>
  )
}

export function Leaderboard({ p, kind }) {
  const rows = useGameStore((s) => s.leaderboard[kind] || [])
  const me = useGameStore((s) => s.leaderboard.me)
  const wins = kind === 'wins'
  const title = wins ? 'MOST WINS' : 'MOST SPEED'
  const accent = wins ? '#ffd21f' : '#4fd8ff'
  const deep = wins ? '#3a2a06' : '#06283a'
  const postH = 12 + p[1]
  const tex = useMemo(() => makeBoardTexture(), [])
  const [fontLoaded, setFontLoaded] = useState(false)
  useEffect(() => {
    let live = true
    loadBoardFont().then(() => live && setFontLoaded(true))
    return () => {
      live = false
    }
  }, [])
  useEffect(() => {
    drawBoard(tex, { rows: rows.slice(0, 10), kind, accent, me })
  }, [tex, rows, kind, accent, me, fontLoaded])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <group position={p}>
      {/* Posts and frame */}
      <B p={[-6.9, 12 - postH / 2, 0]} s={[1.2, postH, 1.2]} c="#5a5d66" />
      <B p={[6.9, 12 - postH / 2, 0]} s={[1.2, postH, 1.2]} c="#5a5d66" />
      <B p={[0, 6.3, 0]} s={[13.6, 12.2, 0.5]} c={accent} glow={1.1} />
      <B p={[0, 6.3, 0.12]} s={[12.8, 11.4, 0.4]} c="#10141c" />
      {/* The screen: names and scores drawn crisp on a canvas, unaffected by lighting. */}
      <mesh position={[0, 6.3, 0.34]}>
        <planeGeometry args={[12.6, 11.2]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* Title plate */}
      <B p={[0, 13.2, 0.1]} s={[11, 1.9, 0.6]} c={accent} glow={0.6} />
      <B p={[0, 13.2, 0.25]} s={[10.5, 1.5, 0.5]} c={deep} />
      <Label text={title} p={[0, 13.2, 0.56]} size={1.15} color={accent} outline="#000000" />
      {[-1, 1].map((side) => (
        <B key={side} p={[side * 6.2, 13.2, 0.1]} s={[1.1, 1.1, 0.6]} r={[0, 0, Math.PI / 4]} c={accent} glow={1.4} />
      ))}
      <BoardBulbs color={accent} />
      <Crown />
      <GroundGlow color={accent} size={16} opacity={0.35} y={-p[1] + 0.06} />
    </group>
  )
}

/* ------------------------------------------------------------------------ */
/* Spinning logs (stage 6)                                                   */
/* ------------------------------------------------------------------------ */

const _euler = new Euler()
const _quat = new Quaternion()

export function Spinner({ p, len, speed }) {
  const body = useRef(null)
  const angle = useRef(0)
  useFrame((_s, dt) => {
    angle.current += speed * Math.min(dt, 0.05)
    _quat.setFromEuler(_euler.set(0, angle.current, 0))
    body.current?.setNextKinematicRotation(_quat)
  })
  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={p}>
      <CuboidCollider args={[len / 2, 0.3, 0.3]} />
      <Cyl p={[0, 0, 0]} radius={0.3} h={len} r={[0, 0, Math.PI / 2]} c="#8b5a2b" />
      <Cyl p={[len / 2 - 0.3, 0, 0]} radius={0.32} h={0.25} r={[0, 0, Math.PI / 2]} c="#e8262c" />
      <Cyl p={[-len / 2 + 0.3, 0, 0]} radius={0.32} h={0.25} r={[0, 0, Math.PI / 2]} c="#e8262c" />
    </RigidBody>
  )
}

/* ------------------------------------------------------------------------ */

const CLOUD_MAT = mat('#ffffff', { glow: 0.55, rough: 1 })

/** Puffy clouds on a ring around the camera; the Sky group moves them with it. */
export function Clouds() {
  const group = useRef(null)
  useBake(group, 'clouds')
  const clouds = useMemo(() => {
    const out = []
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + (i % 3) * 0.1
      const r = 300 + ((i * 37) % 120)
      out.push({ p: [Math.cos(a) * r, 90 + ((i * 13) % 50), Math.sin(a) * r], s: 10 + ((i * 7) % 9), rot: a })
    }
    return out
  }, [])
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={c.p} scale={c.s} rotation={[0, -c.rot, 0]}>
          {[
            [0, 0, 0, 1.6],
            [1.5, -0.2, 0.3, 1.2],
            [-1.5, -0.25, 0, 1.15],
            [0.6, 0.6, -0.2, 1.1],
            [-0.7, 0.45, 0.3, 1],
          ].map(([x, y, z, r], k) => (
            <mesh key={k} geometry={BLOB_GEO} material={CLOUD_MAT} position={[x, y, z]} scale={[r, r * 0.7, r]} />
          ))}
        </group>
      ))}
    </group>
  )
}
