import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, DoubleSide, MeshStandardMaterial } from 'three'

import { runtime } from '../runtime'
import { B, Ball, Cyl } from '../shinobi/prims'
import ShinobiModel from '../shinobi/ShinobiModel'
import { Label } from './Label'
import { GroundGlow, RisingArrows } from './Props'
import { getTexture } from './textures'

/** Decorative, non-colliding stage props. The rules live in triggers / Player.jsx. */

function LaunchPad() {
  const top = useRef(null)
  useFrame(({ clock }) => {
    if (top.current) top.current.emissiveIntensity = 1.3 + Math.sin(clock.elapsedTime * 5) * 0.4
  })
  return (
    <group>
      <mesh position={[0, 0.15, 0]} receiveShadow>
        <cylinderGeometry args={[2.3, 2.5, 0.3, 8]} />
        <meshStandardMaterial color="#1f7a2a" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.33, 0]}>
        <cylinderGeometry args={[2.05, 2.05, 0.06, 8]} />
        <meshStandardMaterial ref={top} color="#39e34a" emissive="#39e34a" emissiveIntensity={1.3} />
      </mesh>
      {/* Leaf emblem */}
      <mesh position={[0, 0.38, 0]} rotation={[-Math.PI / 2, 0, 0.6]}>
        <circleGeometry args={[0.9, 3]} />
        <meshBasicMaterial color="#eaffd8" toneMapped={false} />
      </mesh>
      <GroundGlow color="#39e34a" size={7} opacity={0.5} y={0.02} />
      <RisingArrows radius={1.8} />
    </group>
  )
}

/** Minato's three-pronged Flying Raijin kunai, stuck point-down. */
function Kunai() {
  const spin = useRef(null)
  useFrame(({ clock }, dt) => {
    if (!spin.current) return
    spin.current.rotation.y += dt * 1.5
    spin.current.position.y = 1.6 + Math.sin(clock.elapsedTime * 2.5) * 0.15
  })
  const gold = { c: '#ffd21f', glow: 1.4, metal: 0.5, rough: 0.3 }
  return (
    <group>
      <group ref={spin} position={[0, 1.6, 0]} scale={1.3}>
        <Cyl p={[0, 0.35, 0]} radius={0.07} h={0.8} c="#2a2a2a" />
        <Cyl p={[0, 0.2, 0]} radius={0.09} h={0.12} c="#e8e2d6" />
        <mesh position={[0, 0.86, 0]}>
          <torusGeometry args={[0.16, 0.04, 8, 16]} />
          <meshStandardMaterial color="#c9ced6" metalness={0.8} roughness={0.3} />
        </mesh>
        {[-1, 0, 1].map((i) => (
          <group key={i} rotation={[0, 0, i * 0.55]}>
            <mesh position={[0, -0.45, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.11, i === 0 ? 0.9 : 0.6, 4]} />
              <meshStandardMaterial color={gold.c} emissive={gold.c} emissiveIntensity={gold.glow} metalness={0.5} roughness={0.3} />
            </mesh>
          </group>
        ))}
        <B p={[0, 0.5, 0.1]} s={[0.35, 0.5, 0.02]} c="#fff6d8" />
      </group>
      <GroundGlow color="#ffd21f" size={5} opacity={0.6} />
      <Sparkles count={16} scale={[2, 3, 2]} position={[0, 1.5, 0]} size={5} color="#ffe23a" speed={1.2} />
    </group>
  )
}

/** Obito's Kamui swirl. The real one has a spinning Sharingan above it. */
function Portal({ real }) {
  const swirl = useRef(null)
  const eye = useRef(null)
  const map = useMemo(() => getTexture('glow'), [])
  useFrame((_s, dt) => {
    if (swirl.current) swirl.current.rotation.z += dt * 3
    if (eye.current) eye.current.rotation.z -= dt * 2.5
  })
  const color = real ? '#9a4dff' : '#6a2aa8'
  return (
    <group position={[0, 2.2, 0]}>
      <group ref={swirl}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]} scale={1 - i * 0.22}>
            <torusGeometry args={[1.6, 0.14, 8, 32, Math.PI * 1.4]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} />
          </mesh>
        ))}
      </group>
      <mesh>
        <circleGeometry args={[1.7, 32]} />
        <meshBasicMaterial map={map} color="#2a0a4a" transparent opacity={0.9} side={DoubleSide} depthWrite={false} />
      </mesh>
      {real && (
        <group ref={eye} position={[0, 2.6, 0]}>
          <mesh>
            <circleGeometry args={[0.55, 24]} />
            <meshBasicMaterial color="#e0101a" side={DoubleSide} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <circleGeometry args={[0.16, 16]} />
            <meshBasicMaterial color="#111" side={DoubleSide} />
          </mesh>
          {[0, 1, 2].map((i) => {
            const a = (i * Math.PI * 2) / 3
            return (
              <mesh key={i} position={[Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0.02]}>
                <circleGeometry args={[0.09, 12]} />
                <meshBasicMaterial color="#111" side={DoubleSide} />
              </mesh>
            )
          })}
          <mesh position={[0, 0, -0.01]}>
            <ringGeometry args={[0.55, 0.62, 24]} />
            <meshBasicMaterial color="#111" side={DoubleSide} />
          </mesh>
        </group>
      )}
      <Sparkles count={14} scale={[3.5, 3.5, 1]} size={4} color="#c07bff" speed={1} />
    </group>
  )
}

/** Summoned toad; `p` is the top of its head, which is the bounce pad. */
function Toad({ s = 1, big }) {
  const body = big ? '#d9542a' : '#e68a3a'
  const belly = '#f3cf8a'
  return (
    <group scale={s}>
      <Ball p={[0, -1.6, 0]} s={[2.6, 1.6, 2.7]} c={body} rough={0.6} />
      <Ball p={[0, -2.2, 1.4]} s={[1.9, 1.1, 1.4]} c={belly} rough={0.6} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Ball p={[side * 1.3, -0.15, 1.2]} s={0.62} c={body} />
          <Ball p={[side * 1.3, -0.1, 1.62]} s={[0.45, 0.45, 0.3]} c="#ffe23a" />
          <B p={[side * 1.3, -0.1, 1.92]} s={[0.08, 0.5, 0.05]} c="#111" />
          <Ball p={[side * 1.9, -2.9, 1.9]} s={[0.7, 0.4, 0.9]} c={body} />
        </group>
      ))}
      <B p={[0, -1.1, 2.55]} s={[2.2, 0.08, 0.05]} c="#5a1a0a" />
      {big && (
        <>
          <B p={[0, -1.6, 0]} s={[5.4, 1.2, 5.6]} c="#2a4a8a" opacity={0.95} />
          <Cyl p={[1.6, -1.25, 2.7]} radius={0.14} h={2.4} r={[1.2, 0, 0]} c="#6b4423" />
          <Cyl p={[1.6, -0.4, 3.7]} radius={0.3} h={0.5} c="#6b4423" />
        </>
      )}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 1.6, 24]} />
        <meshBasicMaterial color="#39ff4a" transparent opacity={0.8} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Waterfall({ w, h }) {
  const mat = useRef(null)
  const map = useMemo(() => getTexture('falls', w / 6, h / 6), [w, h])
  useFrame((_s, dt) => {
    if (mat.current?.map) mat.current.map.offset.y += dt * 1.2
  })
  return (
    <group>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial ref={mat} map={map} color="#ffffff" emissive="#2a8ad0" emissiveIntensity={0.25} transparent opacity={0.92} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <Ball key={i} p={[-w / 2 + 1.5 + i * ((w - 3) / 8), -h / 2 + 0.2, 0.8]} s={[1.6, 0.9, 1.2]} c="#ffffff" glow={0.4} />
      ))}
      <Sparkles count={40} scale={[w, 3, 3]} position={[0, -h / 2 + 1.5, 1.5]} size={10} color="#ffffff" speed={1.5} />
    </group>
  )
}

const STONE = new MeshStandardMaterial({ color: '#9a9790', roughness: 0.95, flatShading: true })

/** A shinobi carved in stone (Valley of the End). */
function Statue({ id, scale }) {
  const group = useRef(null)
  useLayoutEffect(() => {
    group.current?.traverse((o) => {
      if (o.isMesh) {
        o.material = STONE
        o.castShadow = true
      }
      if (o.isPoints) o.visible = false
    })
  })
  return (
    <group ref={group} scale={scale}>
      <ShinobiModel id={id} posed poseOverride={{ aR: [-1.7, 0.4], aL: [0, 0.08], lL: [0, 0.08], lR: [0, -0.08] }} />
    </group>
  )
}

/** Itachi's red moon. Only shown near its own stage, or it would hang over others. */
function Moon({ z }) {
  const group = useRef(null)
  useFrame(() => {
    if (group.current) group.current.visible = Math.abs(runtime.position[2] - z) < 110
  })
  return (
    <group ref={group}>
      <mesh>
        <circleGeometry args={[14, 40]} />
        <meshBasicMaterial color="#ff2a1a" fog={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.1]}>
        <circleGeometry args={[20, 40]} />
        <meshBasicMaterial color="#ff4a2a" transparent opacity={0.25} fog={false} blending={AdditiveBlending} />
      </mesh>
    </group>
  )
}

/** Itachi's crows, circling overhead. */
function Crows() {
  const group = useRef(null)
  const wings = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (group.current) group.current.rotation.y = t * 0.4
    wings.current.forEach((w, i) => {
      if (w) w.rotation.z = Math.sin(t * 10 + i) * 0.6
    })
  })
  return (
    <group ref={group}>
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2
        const r = 8 + (i % 3) * 3
        return (
          <group key={i} position={[Math.cos(a) * r, (i % 3) * 2, Math.sin(a) * r]} rotation={[0, -a, 0]}>
            <B p={[0, 0, 0]} s={[0.35, 0.3, 0.9]} c="#111" />
            <B p={[0, 0.1, 0.5]} s={[0.25, 0.25, 0.25]} c="#111" />
            <group ref={(m) => (wings.current[i * 2] = m)}>
              <B p={[0.7, 0, 0]} s={[1.2, 0.05, 0.5]} c="#1a1a1a" />
            </group>
            <group ref={(m) => (wings.current[i * 2 + 1] = m)}>
              <B p={[-0.7, 0, 0]} s={[1.2, 0.05, 0.5]} c="#1a1a1a" />
            </group>
          </group>
        )
      })}
    </group>
  )
}

function Target() {
  return (
    <group>
      <Cyl p={[0, 1.4, 0]} radius={0.15} h={2.8} c="#8b5a2b" />
      <group position={[0, 2.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
        {['#ffffff', '#e8262c', '#ffffff', '#e8262c'].map((c, i) => (
          <Cyl key={i} p={[0, -i * 0.02, 0]} radius={1.2 - i * 0.28} h={0.12 + i * 0.02} c={c} />
        ))}
      </group>
      <B p={[0.2, 2.9, 0.3]} s={[0.06, 0.06, 0.8]} r={[0.3, 0, 0]} c="#3a3d44" />
      <B p={[-0.3, 2.6, 0.3]} s={[0.06, 0.06, 0.8]} r={[0.2, 0.3, 0]} c="#3a3d44" />
    </group>
  )
}

function Gourd() {
  return (
    <group scale={2.2}>
      <Ball p={[0, 1.1, 0]} s={1.1} c="#c9a36b" rough={0.8} />
      <Ball p={[0, 2.5, 0]} s={0.75} c="#c9a36b" rough={0.8} />
      <Cyl p={[0, 1.85, 0]} radius={0.6} h={0.2} c="#8a3a2a" />
      <Cyl p={[0, 3.3, 0]} radius={0.2} h={0.35} c="#6b4423" />
    </group>
  )
}

/** A soft column of light over the win pad, so the finish is visible from afar. */
function Beam({ color }) {
  const mesh = useRef(null)
  useFrame(({ clock }) => {
    if (mesh.current) mesh.current.material.opacity = 0.22 + Math.sin(clock.elapsedTime * 3) * 0.06
  })
  return (
    <group>
      <mesh ref={mesh} position={[0, 10, 0]}>
        <cylinderGeometry args={[3, 3.6, 20, 24, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} side={DoubleSide} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      <Sparkles count={30} scale={[6, 10, 6]} position={[0, 5, 0]} size={7} speed={1.2} color={color} />
    </group>
  )
}

/** A full-size shinobi taking part in the stage (Pain above the crater, etc.). */
function StageShinobi({ id, scale = 1.6, float }) {
  const group = useRef(null)
  useFrame(({ clock }) => {
    if (float && group.current) group.current.position.y = Math.sin(clock.elapsedTime * 1.5) * 0.4
  })
  return (
    <group ref={group} scale={scale}>
      <ShinobiModel id={id} posed />
    </group>
  )
}

export function StageProp({ prop }) {
  const { kind, p, yaw = 0 } = prop
  let node = null
  if (kind === 'launch') node = <LaunchPad />
  else if (kind === 'kunai') node = <Kunai />
  else if (kind === 'portal') node = <Portal real={prop.real} />
  else if (kind === 'toad') node = <Toad s={prop.s} big={prop.big} />
  else if (kind === 'waterfall') node = <Waterfall w={prop.w} h={prop.h} />
  else if (kind === 'statue') node = <Statue id={prop.id} scale={prop.scale} />
  else if (kind === 'moon') node = <Moon z={p[2]} />
  else if (kind === 'crows') node = <Crows />
  else if (kind === 'target') node = <Target />
  else if (kind === 'gourd') node = <Gourd />
  else if (kind === 'beam') node = <group scale={prop.scale ?? 1}><Beam color={prop.color} /></group>
  else if (kind === 'shinobi') node = <StageShinobi id={prop.id} scale={prop.scale} float={prop.float} />
  if (!node) return null
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      {node}
      {kind === 'launch' && <Label text="JUMP!" p={[0, 3.2, 0]} size={0.8} color="#7dff3a" outline="#0a2a0a" billboard />}
    </group>
  )
}
