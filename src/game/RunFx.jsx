import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, Color, CylinderGeometry, IcosahedronGeometry, Object3D, SphereGeometry, Vector3 } from 'three'

import { FootPrints } from './Aura'
import { auraFor } from './config'
import { getGame } from './gameStore'
import { now } from './level/mechanics'
import { flightPoint, runtime } from './runtime'

/**
 * Anime-style "feel" effects around the player, all driven from `runtime`:
 * the aura's running/jumping particles, footstep dust, landing rings, dash bursts,
 * wind streaks at speed, the Flying Raijin streak, the trophy rain after a stage
 * win, the level-up glow and the rebirth pillar of light. Footprints for everyone
 * in the lobby live here too.
 */

const PUFFS = 28
const PUFF_LIFE = 0.6
const RINGS = 6
const RING_LIFE = 0.5
const STREAKS = 18
const COINS = 70
const RAIN_TIME = 3.2

const _obj = new Object3D()

/** Calls `fn` for every queued effect event this consumer hasn't seen yet. */
function useFxEvents(types, fn) {
  const seen = useRef(runtime.fxSeq)
  return () => {
    for (const e of runtime.fx) {
      if (e.id <= seen.current) continue
      if (types.includes(e.type)) fn(e)
    }
    seen.current = runtime.fxSeq
  }
}
const _vel = new Vector3()
const _last = new Vector3()

const PUFF_GEO = new SphereGeometry(1, 8, 6)

// Effect pools live at module scope: there is only ever one player.
const PUFF_POOL = Array.from({ length: PUFFS }, () => ({ at: -99, p: [0, 0, 0], dx: 0, dz: 0 }))
const RING_POOL = Array.from({ length: RINGS }, () => ({ at: -99, p: [0, 0, 0], dash: false }))
const COIN_GEO = new CylinderGeometry(0.45, 0.45, 0.12, 14)

function Dust() {
  const mesh = useRef(null)
  const pool = PUFF_POOL
  const next = useRef(0)
  const consume = useFxEvents(['dust', 'land'], (e) => {
    {
      const n = e.type === 'land' ? 6 : 2
      for (let i = 0; i < n; i++) {
        const puff = pool[next.current++ % PUFFS]
        const a = Math.random() * Math.PI * 2
        const spread = e.type === 'land' ? 1.2 : 0.4
        puff.at = e.at
        puff.p = [e.p[0] + Math.cos(a) * 0.3, e.p[1] + 0.15, e.p[2] + Math.sin(a) * 0.3]
        puff.dx = Math.cos(a) * spread
        puff.dz = Math.sin(a) * spread
      }
    }
  })
  useFrame(() => {
    const t = now()
    consume()
    const m = mesh.current
    if (!m) return
    pool.forEach((puff, i) => {
      const k = (t - puff.at) / PUFF_LIFE
      if (k < 0 || k > 1) {
        _obj.scale.setScalar(0.0001)
      } else {
        _obj.position.set(puff.p[0] + puff.dx * k, puff.p[1] + k * 0.5, puff.p[2] + puff.dz * k)
        _obj.scale.setScalar((0.25 + k * 0.55) * (1 - k * 0.4))
      }
      _obj.updateMatrix()
      m.setMatrixAt(i, _obj.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[PUFF_GEO, null, PUFFS]} frustumCulled={false}>
      <meshStandardMaterial color="#f3ead8" transparent opacity={0.55} depthWrite={false} roughness={1} />
    </instancedMesh>
  )
}

/** Landing shock rings and blue chakra rings when dashing. */
function Rings() {
  const refs = useRef([])
  const pool = RING_POOL
  const next = useRef(0)
  const consume = useFxEvents(['land', 'dash'], (e) => {
    const r = pool[next.current++ % RINGS]
    r.at = e.at
    r.p = e.p
    r.dash = e.type === 'dash'
  })
  useFrame(() => {
    const t = now()
    consume()
    pool.forEach((r, i) => {
      const m = refs.current[i]
      if (!m) return
      const k = (t - r.at) / RING_LIFE
      m.visible = k >= 0 && k <= 1
      if (!m.visible) return
      m.position.set(r.p[0], r.p[1] + (r.dash ? 0 : 0.08), r.p[2])
      m.rotation.set(r.dash ? 0 : -Math.PI / 2, 0, 0)
      if (r.dash) m.lookAt(runtime.position[0], runtime.position[1], runtime.position[2] - 1)
      m.scale.setScalar(0.5 + k * (r.dash ? 3 : 2.2))
      m.material.opacity = (1 - k) * 0.8
      m.material.color.set(r.dash ? '#6fd8ff' : '#ffffff')
    })
  })
  return pool.map((_, i) => (
    <mesh key={i} ref={(m) => (refs.current[i] = m)} visible={false}>
      <ringGeometry args={[0.7, 1, 32]} />
      <meshBasicMaterial transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
    </mesh>
  ))
}

/** White speed lines rushing past the player once they are really moving. */
function WindStreaks() {
  const group = useRef(null)
  const refs = useRef([])
  const seeds = useMemo(
    () =>
      Array.from({ length: STREAKS }, (_, i) => ({
        a: (i / STREAKS) * Math.PI * 2 + (i % 3) * 0.4,
        r: 1.2 + ((i * 37) % 10) / 6,
        y: 0.3 + ((i * 13) % 10) / 5,
        ph: ((i * 7) % 10) / 10,
      })),
    [],
  )
  useFrame((_s, dt) => {
    const [x, y, z] = runtime.position
    _vel.set(x, y, z).sub(_last).divideScalar(Math.max(dt, 1e-3))
    _last.set(x, y, z)
    const g = group.current
    if (!g) return
    const strength = Math.max(0, (runtime.speedRatio - 0.35) / 0.65)
    g.visible = strength > 0.02 && !runtime.dead
    if (!g.visible) return
    g.position.set(x, y - 0.9, z)
    _vel.y = 0
    if (_vel.lengthSq() > 1) g.rotation.y = Math.atan2(_vel.x, _vel.z)
    const t = now()
    seeds.forEach((sd, i) => {
      const m = refs.current[i]
      if (!m) return
      const k = (t * 2.2 + sd.ph) % 1
      m.position.set(Math.cos(sd.a) * sd.r, sd.y + Math.sin(sd.a) * 0.5, 4 - k * 9)
      m.material.opacity = strength * 0.55 * Math.sin(k * Math.PI)
    })
  })
  return (
    <group ref={group}>
      {seeds.map((_, i) => (
        <mesh key={i} ref={(m) => (refs.current[i] = m)}>
          <boxGeometry args={[0.04, 0.04, 2.6]} />
          <meshBasicMaterial color="#ffffff" transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

/** Gold trophy-coins rain from the sky after a stage win. */
function WinRain() {
  const mesh = useRef(null)
  const glow = useRef(null)
  const drops = useMemo(
    () =>
      Array.from({ length: COINS }, (_, i) => ({
        x: (((i * 53) % 100) / 100 - 0.5) * 16,
        z: (((i * 29) % 100) / 100 - 0.5) * 16,
        delay: ((i * 17) % 100) / 100 * 1.6,
        spin: 3 + (i % 5),
      })),
    [],
  )
  const origin = useRef([0, 0, 0])
  const lastAt = useRef(0)
  useLayoutEffect(() => {
    _obj.scale.setScalar(0.0001)
    _obj.updateMatrix()
    for (let i = 0; i < COINS; i++) mesh.current.setMatrixAt(i, _obj.matrix)
  }, [])
  useFrame(() => {
    const rain = runtime.winRain
    const m = mesh.current
    if (!m) return
    const age = rain ? (performance.now() - rain.at) / 1000 : 99
    // Centre the rain on the lobby spawn the player is sent back to.
    if (rain && rain.at !== lastAt.current) {
      lastAt.current = rain.at
      origin.current = [...rain.pos]
    }
    const active = age < RAIN_TIME + 1.5
    m.visible = active
    if (glow.current) glow.current.visible = active && age < RAIN_TIME
    if (!active) return
    const [ox, oy, oz] = origin.current
    drops.forEach((d, i) => {
      const k = age - 0.2 - d.delay
      if (k < 0) {
        _obj.scale.setScalar(0.0001)
      } else {
        const y = Math.max(0.1, 14 - k * 11)
        _obj.position.set(ox + d.x, oy - 0.9 + y, oz + d.z)
        _obj.rotation.set(Math.PI / 2, k * d.spin, 0)
        _obj.scale.setScalar(y <= 0.1 ? Math.max(0.0001, 1 - (k - 1.25) * 0.8) : 1)
      }
      _obj.updateMatrix()
      m.setMatrixAt(i, _obj.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    if (glow.current) glow.current.position.set(ox, oy + 1, oz)
  })
  return (
    <>
      <instancedMesh ref={mesh} args={[COIN_GEO, null, COINS]} frustumCulled={false} visible={false}>
        <meshStandardMaterial color="#ffc21f" emissive="#ffb000" emissiveIntensity={0.6} metalness={0.6} roughness={0.3} />
      </instancedMesh>
      <group ref={glow} visible={false}>
        <Sparkles count={60} scale={[14, 8, 14]} size={9} speed={1.5} color="#ffe23a" />
      </group>
    </>
  )
}

/**
 * Flying Raijin (stage 10): a golden comet streak along the arc the player flies,
 * sparks around them in the air, and a flash where they took off.
 */
const STREAK = 34
const STREAK_GEO = new SphereGeometry(1, 10, 8)
const _p = [0, 0, 0]

function FlightFx() {
  const mesh = useRef(null)
  const flash = useRef(null)
  const sparks = useRef(null)
  useLayoutEffect(() => {
    _obj.scale.setScalar(0.0001)
    _obj.updateMatrix()
    for (let i = 0; i < STREAK; i++) mesh.current.setMatrixAt(i, _obj.matrix)
  }, [])
  useFrame(() => {
    const f = runtime.flight
    const m = mesh.current
    if (!m) return
    const age = f ? (performance.now() - f.start) / 1000 : 99
    const u = f ? Math.min(1, age / f.dur) : 1
    // The streak lingers a moment after landing, then fades out.
    const after = f ? Math.max(0, age - f.dur) / 0.45 : 1
    const on = Boolean(f) && after < 1
    m.visible = on
    if (sparks.current) sparks.current.visible = on && u < 1
    if (flash.current) {
      const k = age / 0.5
      flash.current.visible = Boolean(f) && k < 1
      if (flash.current.visible) {
        flash.current.position.set(f.from[0], f.from[1], f.from[2])
        flash.current.scale.setScalar(0.6 + k * 3.5)
        flash.current.material.opacity = 0.9 * (1 - k)
      }
    }
    if (!on) return
    const tail = 0.4
    for (let i = 0; i < STREAK; i++) {
      const k = i / (STREAK - 1)
      const uu = Math.max(0, u - tail * (1 - k))
      flightPoint(f, uu, _p)
      _obj.position.set(_p[0], _p[1], _p[2])
      const size = (0.12 + k * 0.5) * (1 - after)
      _obj.scale.setScalar(Math.max(0.0001, size))
      _obj.updateMatrix()
      m.setMatrixAt(i, _obj.matrix)
    }
    m.instanceMatrix.needsUpdate = true
    if (sparks.current) {
      const [x, y, z] = runtime.position
      sparks.current.position.set(x, y, z)
    }
  })
  return (
    <>
      <instancedMesh ref={mesh} args={[STREAK_GEO, null, STREAK]} frustumCulled={false} visible={false}>
        <meshBasicMaterial color="#ffe45a" transparent opacity={0.75} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <mesh ref={flash} visible={false}>
        <sphereGeometry args={[1, 20, 14]} />
        <meshBasicMaterial color="#fff2a0" transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={sparks} visible={false}>
        <Sparkles count={40} scale={[2.6, 2.6, 2.6]} size={10} speed={3} color="#ffe45a" />
      </group>
    </>
  )
}

/** A golden glow that wraps the player and rings rising up them on every level-up. */
const LEVEL_FX_TIME = 1.8

function LevelUpGlow() {
  const group = useRef(null)
  const aura = useRef(null)
  const rings = useRef([])
  useFrame(() => {
    const g = group.current
    if (!g) return
    const age = (performance.now() - runtime.levelUpFx) / 1000
    g.visible = runtime.levelUpFx > 0 && age < LEVEL_FX_TIME
    if (!g.visible) return
    const [x, y, z] = runtime.position
    g.position.set(x, y - 0.9, z)
    const fade = 1 - age / LEVEL_FX_TIME
    if (aura.current) {
      aura.current.scale.set(1 + Math.sin(age * 12) * 0.06, 1 + age * 0.15, 1 + Math.sin(age * 12) * 0.06)
      aura.current.material.opacity = 0.5 * fade
    }
    rings.current.forEach((r, i) => {
      if (!r) return
      const k = (age * 1.4 + i / 3) % 1
      r.position.y = k * 2.6
      r.scale.setScalar(0.9 + (1 - k) * 0.5)
      r.material.opacity = Math.sin(k * Math.PI) * fade
    })
  })
  return (
    <group ref={group} visible={false}>
      <mesh ref={aura} position={[0, 1.1, 0]}>
        <capsuleGeometry args={[0.75, 1.3, 6, 16]} />
        <meshBasicMaterial color="#ffd23a" transparent opacity={0.5} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => (rings.current[i] = m)} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.85, 1.05, 32]} />
          <meshBasicMaterial color="#5fe0ff" transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={2} />
        </mesh>
      ))}
      <Sparkles count={40} scale={[2.4, 3.2, 2.4]} position={[0, 1.4, 0]} size={8} speed={2} color="#ffe89a" />
    </group>
  )
}

/** A pink pillar of light and sparkles when the player rebirths. */
function RebirthBurst() {
  const group = useRef(null)
  const beam = useRef(null)
  useFrame(() => {
    const age = (performance.now() - runtime.rebirthFx) / 1000
    const g = group.current
    if (!g) return
    g.visible = runtime.rebirthFx > 0 && age < 2.4
    if (!g.visible) return
    const [x, y, z] = runtime.position
    g.position.set(x, y - 0.9, z)
    if (beam.current) {
      const k = Math.min(1, age / 0.3)
      beam.current.scale.set(1 + age * 0.6, k, 1 + age * 0.6)
      beam.current.material.opacity = 0.55 * (1 - Math.max(0, age - 1.2) / 1.2)
    }
  })
  return (
    <group ref={group} visible={false}>
      <mesh ref={beam} position={[0, 15, 0]}>
        <cylinderGeometry args={[1.4, 2, 30, 24, 1, true]} />
        <meshBasicMaterial color="#ff6ae0" transparent blending={AdditiveBlending} depthWrite={false} side={2} toneMapped={false} />
      </mesh>
      <Sparkles count={80} scale={[6, 12, 6]} position={[0, 6, 0]} size={10} speed={2.5} color="#ff9af0" />
    </group>
  )
}

/* ------------------------------------------------------------------------ */
/* Aura particles: each aura's own sparks while running and jumping          */
/* ------------------------------------------------------------------------ */

const SPARKS = 160
const SPARK_GEO = new IcosahedronGeometry(0.6, 0)
const SPARK_POOL = Array.from({ length: SPARKS }, () => ({
  at: -99,
  life: 1,
  p: new Vector3(),
  v: new Vector3(),
  g: 0,
  size: [1, 1, 1],
  spin: 0,
  swirl: 0,
}))
const _white = new Color('#ffffff')
const _c = new Color()

/**
 * Per style: how a particle moves and looks. `v(out)` fills the start velocity.
 * g = vertical acceleration, size = box scale, swirl = sideways wobble.
 */
const STYLES = {
  spark: { life: 0.5, g: -9, size: [0.13, 0.13, 0.13], v: (o) => rnd(o, 3).setY(2 + Math.random() * 3) },
  petal: { life: 1.3, g: -1.2, size: [0.24, 0.03, 0.18], swirl: 3, v: (o) => rnd(o, 1.2).setY(1 + Math.random() * 1.5) },
  bolt: { life: 0.28, g: 0, size: [0.05, 0.05, 0.7], v: (o) => rnd(o, 4).setY((Math.random() - 0.3) * 4) },
  leaf: { life: 1.1, g: -0.8, size: [0.26, 0.03, 0.2], swirl: 5, v: (o) => rnd(o, 1.6).setY(1.5 + Math.random()) },
  sand: { life: 0.9, g: -0.4, size: [0.3, 0.2, 0.3], v: (o) => rnd(o, 1.6).setY(0.4 + Math.random() * 0.6) },
  flame: { life: 0.65, g: 2.5, size: [0.3, 0.34, 0.3], v: (o) => rnd(o, 0.7).setY(2 + Math.random() * 1.5) },
  feather: { life: 1.5, g: -0.9, size: [0.1, 0.02, 0.38], swirl: 2.5, v: (o) => rnd(o, 1.2).setY(1 + Math.random()) },
  aura: { life: 0.55, g: 0, size: [0.07, 0.9, 0.07], v: (o) => o.set(0, 4 + Math.random() * 3, 0) },
}

function rnd(out, r) {
  const a = Math.random() * Math.PI * 2
  const m = r * (0.4 + Math.random() * 0.6)
  return out.set(Math.cos(a) * m, 0, Math.sin(a) * m)
}

function CharacterFx() {
  const mesh = useRef(null)
  const next = useRef(0)
  const look = useRef({ id: null, style: STYLES.spark, color: new Color(), power: 0 })

  const emit = (e, n, burst) => {
    const L = look.current
    const st = L.style
    for (let i = 0; i < n; i++) {
      const idx = next.current++ % SPARKS
      const sp = SPARK_POOL[idx]
      sp.at = e.at
      sp.life = st.life * (0.8 + Math.random() * 0.4)
      st.v(sp.v)
      if (burst) sp.v.multiplyScalar(1.8).setY(sp.v.y + 1.5)
      const ring = st === STYLES.aura ? 0.55 : 0.25
      const a = Math.random() * Math.PI * 2
      sp.p.set(e.p[0] + Math.cos(a) * ring, e.p[1] + 0.2 + (st === STYLES.aura ? Math.random() * 0.8 : 0), e.p[2] + Math.sin(a) * ring)
      sp.g = st.g
      sp.swirl = (st.swirl ?? 0) * (Math.random() < 0.5 ? -1 : 1)
      sp.spin = (Math.random() - 0.5) * 12
      const k = 0.9 + L.power * 0.6
      sp.size = [st.size[0] * k, st.size[1] * k, st.size[2] * k]
      _c.copy(L.color).lerp(_white, Math.random() * 0.45)
      mesh.current?.setColorAt(idx, _c)
    }
    if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true
  }

  const consume = useFxEvents(['dust', 'land', 'jump'], (e) => {
    // No aura, no particles: plain dust and rings only.
    if (!look.current.on) return
    const n = e.type === 'dust' ? 1 + Math.round(look.current.power * 3) : 7 + Math.round(look.current.power * 16)
    emit(e, n, e.type !== 'dust')
  })

  useLayoutEffect(() => {
    _obj.scale.setScalar(0.0001)
    _obj.updateMatrix()
    for (let i = 0; i < SPARKS; i++) {
      mesh.current.setMatrixAt(i, _obj.matrix)
      mesh.current.setColorAt(i, _white)
    }
  }, [])

  useFrame(() => {
    const g = getGame()
    const L = look.current
    const key = `${g.equipped}/${g.aura}`
    if (L.id !== key) {
      const aura = auraFor(g.equipped, g.aura)
      L.id = key
      L.on = Boolean(aura)
      L.style = STYLES[aura?.fx] || STYLES.spark
      L.color.set(aura?.color || '#ffffff')
      L.power = aura?.power ?? 0
    }
    consume()
    const m = mesh.current
    if (!m) return
    const t = now()
    SPARK_POOL.forEach((sp, i) => {
      const age = t - sp.at
      const k = age / sp.life
      if (k < 0 || k > 1) {
        _obj.scale.setScalar(0.0001)
      } else {
        const side = Math.sin(age * 6) * sp.swirl * 0.15
        _obj.position.set(
          sp.p.x + sp.v.x * age + side,
          sp.p.y + sp.v.y * age + 0.5 * sp.g * age * age,
          sp.p.z + sp.v.z * age + side,
        )
        _obj.rotation.set(age * sp.spin, age * sp.spin * 0.7, 0)
        if (sp.size[1] > sp.size[0] * 4) _obj.rotation.set(0, 0, 0)
        const fade = 1 - k * k
        _obj.scale.set(sp.size[0] * fade, sp.size[1] * fade, sp.size[2] * fade)
      }
      _obj.updateMatrix()
      m.setMatrixAt(i, _obj.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[SPARK_GEO, null, SPARKS]} frustumCulled={false}>
      <meshBasicMaterial toneMapped={false} transparent opacity={0.95} depthWrite={false} blending={AdditiveBlending} />
    </instancedMesh>
  )
}

export function RunFx() {
  return (
    <>
      <FootPrints />
      <CharacterFx />
      <Dust />
      <Rings />
      <WindStreaks />
      <WinRain />
      <RebirthBurst />
      <LevelUpGlow />
      <FlightFx />
    </>
  )
}

export default RunFx
