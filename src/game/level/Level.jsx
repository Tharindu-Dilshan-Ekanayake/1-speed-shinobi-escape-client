import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { memo, useMemo, useRef } from 'react'

import { useGameStore } from '../gameStore'
import { runtime } from '../runtime'
import { LEVEL, WORLD_ORIGIN_X } from './buildWorld'
import { Label } from './Label'
import MergedSolids from './MergedSolids'
import { Blinker, Breakable, Crusher, Hazard, Mover, PulseFx, Toppler } from './MechanicsFx'
import GateBarrier from './GateBarrier'
import { Bunting, Chest, Forest, Leaderboard, Pad, Pedestal, Spinner, Treadmill } from './Props'
import { StageProp } from './StageProps'
import { getTexture } from './textures'

/** Only the current world is mounted; the two worlds sit 1000 units apart. */
function inWorld(x, world) {
  return Math.abs(x - WORLD_ORIGIN_X[world]) < 450
}

/** A river, or with `lava` a glowing, bubbling lava floor. */
function Water({ p, s, lava }) {
  const map = useMemo(() => getTexture(lava ? 'lava' : 'water', s[0] / (lava ? 8 : 10), s[1] / (lava ? 8 : 10)), [s, lava])
  const material = useRef(null)
  useFrame(({ clock }, dt) => {
    const mat = material.current
    const tex = mat?.map
    if (!tex) return
    tex.offset.x += dt * (lava ? 0.015 : 0.03)
    tex.offset.y += dt * (lava ? 0.03 : 0.05)
    if (lava) mat.emissiveIntensity = 0.85 + Math.sin(clock.elapsedTime * 2) * 0.15
  })
  return (
    <mesh position={p} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={!lava}>
      <planeGeometry args={s} />
      {lava ? (
        <meshStandardMaterial ref={material} map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={0.9} color="#ffffff" roughness={0.8} />
      ) : (
        <meshStandardMaterial ref={material} map={map} color="#ffffff" roughness={0.3} metalness={0.1} />
      )}
    </mesh>
  )
}

function Colliders({ solids }) {
  return (
    <RigidBody type="fixed" colliders={false} name="level" friction={0.8}>
      {solids.map((sd, i) => (
        <CuboidCollider
          key={i}
          args={[sd.s[0] / 2, sd.s[1] / 2, sd.s[2] / 2]}
          position={sd.p}
          rotation={sd.r}
        />
      ))}
    </RigidBody>
  )
}

/** How far (in z) beyond a chunk's bounds it is still drawn. */
const DRAW_RANGE = 210

/**
 * One stage (or the lobby). Its meshes are hidden whenever the player is far away,
 * which keeps twenty stages as cheap as a couple. Physics is unaffected: every
 * collider lives in the single fixed body built by <Colliders>.
 */
function Chunk({ items }) {
  const group = useRef(null)
  const { zMin, zMax } = items.bounds
  useFrame(() => {
    const z = runtime.position[2]
    if (group.current) group.current.visible = z > zMin - DRAW_RANGE && z < zMax + DRAW_RANGE
  })
  return (
    <group ref={group}>
      <MergedSolids solids={items.solids} />
      {items.water.map((w, i) => (
        <Water key={i} {...w} />
      ))}
      {items.labels.map((l, i) => (
        <Label key={i} {...l} />
      ))}
      {items.pedestals.map((pd) => (
        <Pedestal key={pd.id} {...pd} />
      ))}
      {items.treadmills.map((t, i) => (
        <Treadmill key={i} {...t} />
      ))}
      {items.pads.map((pd, i) => (
        <Pad key={i} {...pd} />
      ))}
      {items.spinners.map((sp, i) => (
        <Spinner key={i} {...sp} />
      ))}
      {items.boards.map((b, i) => (
        <Leaderboard key={i} {...b} />
      ))}
      {items.gates.map((gt, i) => (
        <GateBarrier key={i} {...gt} />
      ))}
      {items.chests.map((c, i) => (
        <Chest key={i} {...c} />
      ))}
      {items.props.map((pr, i) => (
        <StageProp key={i} prop={pr} />
      ))}
      {items.movers.map((m, i) => (
        <Mover key={i} m={m} />
      ))}
      {items.blinkers.map((b, i) => (
        <Blinker key={i} b={b} />
      ))}
      {items.breakables.map((w) => (
        <Breakable key={w.id} w={w} />
      ))}
      {items.hazards.map((h, i) => (
        <Hazard key={i} h={h} />
      ))}
      {items.pulses.map((pl, i) => (
        <PulseFx key={i} {...pl} />
      ))}
      {items.topplers.map((tp) => (
        <Toppler key={tp.id} tp={tp} />
      ))}
      {items.crushers.map((c, i) => (
        <Crusher key={i} c={c} />
      ))}
    </group>
  )
}

const CHUNKED = ['solids', 'water', 'labels', 'pedestals', 'treadmills', 'pads', 'spinners', 'boards', 'gates', 'chests',
  'props', 'movers', 'blinkers', 'breakables', 'hazards', 'pulses', 'topplers', 'crushers']

/** Groups a world's level data by chunk and measures each chunk's z extent. */
function chunksFor(world) {
  const prefix = `${world}-`
  const chunks = new Map()
  const get = (key) => {
    if (!chunks.has(key)) {
      const c = { bounds: { zMin: Infinity, zMax: -Infinity } }
      for (const k of CHUNKED) c[k] = []
      chunks.set(key, c)
    }
    return chunks.get(key)
  }
  for (const k of CHUNKED) {
    for (const it of LEVEL[k]) {
      if (!it.ch?.startsWith(prefix)) continue
      if (k === 'solids' && !it.vis) continue
      const c = get(it.ch)
      c[k].push(it)
      const z = it.p?.[2] ?? it.origin?.[2]
      const half = it.s ? (Array.isArray(it.s) ? (it.s[2] ?? it.s[1] ?? 0) : 0) / 2 : 0
      if (z !== undefined) {
        c.bounds.zMin = Math.min(c.bounds.zMin, z - half)
        c.bounds.zMax = Math.max(c.bounds.zMax, z + half)
      }
    }
  }
  return [...chunks.entries()]
}

const LevelWorld = memo(function LevelWorld({ world }) {
  const data = useMemo(() => {
    const pick = (list) => list.filter((it) => inWorld(it.p[0], world))
    return {
      colliders: pick(LEVEL.solids).filter((sd) => sd.col),
      trees: pick(LEVEL.trees),
      bushes: pick(LEVEL.bushes),
      bunting: LEVEL.bunting.filter((r) => inWorld(r.x0, world)),
      chunks: chunksFor(world),
    }
  }, [world])

  return (
    <>
      <Colliders solids={data.colliders} />
      <Forest trees={data.trees} bushes={data.bushes} />
      <Bunting ropes={data.bunting} />
      {data.chunks.map(([key, items]) => (
        <Chunk key={key} items={items} />
      ))}
    </>
  )
})

export function Level() {
  const world = useGameStore((s) => s.world)
  return <LevelWorld key={world} world={world} />
}

export default Level
