/* eslint-disable react-refresh/only-export-components -- shared primitives plus their helpers */
import {
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/**
 * Low-level building blocks for the blocky Roblox-style characters.
 *
 * Every primitive shares one unit geometry and is sized with `scale`, and materials
 * are cached by colour, so sixteen characters cost a handful of GPU resources rather
 * than a thousand.
 */

const UNIT_BOX = new BoxGeometry(1, 1, 1)
const UNIT_CONE = new ConeGeometry(1, 1, 6)
const UNIT_SPHERE = new SphereGeometry(1, 14, 10)
const UNIT_CYL = new CylinderGeometry(1, 1, 1, 14)
const UNIT_TORUS = new TorusGeometry(1, 0.28, 8, 20)

const materials = new Map()

/**
 * @param {string} color
 * @param {{ glow?: number, opacity?: number, add?: boolean, rough?: number, metal?: number }} [o]
 *   `glow` makes the colour emissive at that intensity (chakra, Kurama gold).
 */
export function mat(color, o = {}) {
  const key = `${color}|${o.glow || 0}|${o.opacity ?? 1}|${o.add ? 1 : 0}|${o.rough ?? 0.75}|${o.metal ?? 0}`
  let m = materials.get(key)
  if (!m) {
    const transparent = (o.opacity ?? 1) < 1
    m = new MeshStandardMaterial({
      color,
      roughness: o.rough ?? 0.75,
      metalness: o.metal ?? 0,
      emissive: o.glow ? color : '#000000',
      emissiveIntensity: o.glow || 0,
      transparent,
      opacity: o.opacity ?? 1,
      depthWrite: !transparent,
      ...(o.add ? { blending: AdditiveBlending } : {}),
    })
    materials.set(key, m)
  }
  return m
}

const shadowFor = (o) => (o.opacity ?? 1) >= 1

/** Box. `p` position, `s` size, `r` euler rotation, `c` colour. */
export function B({ p = [0, 0, 0], s = [1, 1, 1], r, c = '#ffffff', ...o }) {
  return (
    <mesh
      geometry={UNIT_BOX}
      material={mat(c, o)}
      position={p}
      scale={s}
      rotation={r}
      castShadow={shadowFor(o)}
    />
  )
}

const roundedCache = new Map()

/** One RoundedBoxGeometry per distinct size, so bevels never get stretched. */
function roundedGeometry(sx, sy, sz, radius) {
  const key = `${sx}|${sy}|${sz}|${radius}`
  let g = roundedCache.get(key)
  if (!g) {
    g = new RoundedBoxGeometry(sx, sy, sz, 3, Math.min(radius, sx / 2, sy / 2, sz / 2))
    roundedCache.set(key, g)
  }
  return g
}

/** Box with softly rounded edges: body parts, like a Roblox R6 rig. */
export function R({ p = [0, 0, 0], s = [1, 1, 1], r, c = '#ffffff', radius = 0.055, ...o }) {
  return (
    <mesh
      geometry={roundedGeometry(s[0], s[1], s[2], radius)}
      material={mat(c, { rough: 0.6, ...o })}
      position={p}
      rotation={r}
      castShadow={shadowFor(o)}
    />
  )
}

/** Sphere / ellipsoid. `s` is a radius or [rx, ry, rz]. */
export function Ball({ p = [0, 0, 0], s = 0.1, r, c = '#ffffff', ...o }) {
  const scale = Array.isArray(s) ? s : [s, s, s]
  return (
    <mesh
      geometry={UNIT_SPHERE}
      material={mat(c, o)}
      position={p}
      scale={scale}
      rotation={r}
      castShadow={shadowFor(o)}
    />
  )
}

export function Cyl({ p = [0, 0, 0], radius = 0.1, h = 0.1, r, c = '#ffffff', ...o }) {
  return (
    <mesh
      geometry={UNIT_CYL}
      material={mat(c, o)}
      position={p}
      scale={[radius, h, radius]}
      rotation={r}
      castShadow={shadowFor(o)}
    />
  )
}

export function Ring({ p = [0, 0, 0], radius = 0.1, r, c = '#ffffff', ...o }) {
  return (
    <mesh
      geometry={UNIT_TORUS}
      material={mat(c, o)}
      position={p}
      scale={[radius, radius, radius]}
      rotation={r}
    />
  )
}

const _up = new Vector3(0, 1, 0)
const _dir = new Vector3()

/** Degrees -> unit direction. yaw 0 = +Z (the face), pitch 90 = straight up. */
export function dirFrom(yawDeg, pitchDeg) {
  const y = (yawDeg * Math.PI) / 180
  const p = (pitchDeg * Math.PI) / 180
  return [Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)]
}

/** A cone pointing along `dir`, its base `from` + dir * `start`. Hair spikes, tails, flames. */
export function Spike({ from = [0, 0, 0], dir = [0, 1, 0], start = 0, len = 0.3, radius = 0.08, c, ...o }) {
  _dir.set(dir[0], dir[1], dir[2]).normalize()
  const q = new Quaternion().setFromUnitVectors(_up, _dir)
  const d = start + len / 2
  const pos = [from[0] + _dir.x * d, from[1] + _dir.y * d, from[2] + _dir.z * d]
  return (
    <mesh
      geometry={UNIT_CONE}
      material={mat(c, o)}
      position={pos}
      quaternion={q}
      scale={[radius, len, radius]}
      castShadow={shadowFor(o)}
    />
  )
}

/**
 * A bunch of hair spikes around the head.
 * `list` entries are [yawDeg, pitchDeg, len, radius].
 */
export function Spikes({ list, center = [0, 0.3, 0], start = 0.15, c, ...o }) {
  return list.map(([yaw, pitch, len, radius = 0.085], i) => (
    <Spike
      key={i}
      from={center}
      dir={dirFrom(yaw, pitch)}
      start={start}
      len={len}
      radius={radius}
      c={c}
      {...o}
    />
  ))
}

/** Evenly spaced spikes around a circle. */
export function ring(count, pitch, len, radius = 0.085, yawStart = 0, yawSpan = 360) {
  const out = []
  const full = yawSpan >= 360
  for (let i = 0; i < count; i++) {
    const t = full ? i / count : count === 1 ? 0.5 : i / (count - 1)
    out.push([yawStart + t * yawSpan, pitch, len, radius])
  }
  return out
}
