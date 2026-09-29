import { useEffect, useMemo } from 'react'
import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  FrontSide,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { getTexture } from './textures'

/**
 * Draws a chunk's static level boxes as a handful of merged meshes, one per
 * material, instead of one mesh per box. A stage has hundreds of boxes; merged it
 * costs a dozen draw calls.
 *
 * Texture tiling is baked into each box's UVs, so boxes of different sizes can share
 * one material and one texture.
 */

function textureRepeat(s, tex) {
  const [sx, sy, sz] = s
  const unit = { building: 6, lattice: 2.5, templeWall: 8, roof: 3 }[tex] ?? 4
  if (sy < Math.min(sx, sz) * 0.5) return [sx / unit, sz / unit]
  return [Math.max(sx, sz) / unit, sy / unit]
}

const _m = new Matrix4()
const _q = new Quaternion()
const _e = new Euler()
const _p = new Vector3()
const _s = new Vector3(1, 1, 1)

function scaleUv(geo, rx, ry) {
  const uv = geo.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rx, uv.getY(i) * ry)
  return geo
}

/** World-space geometries for one solid (a dome is two parts). */
function geometriesFor(sd) {
  const { p, s, r, shape, tex, rep } = sd
  const [rx, ry] = tex ? (rep ?? textureRepeat(s, tex)) : [1, 1]
  const place = (geo, pos, rot) => {
    _q.setFromEuler(_e.set(...(rot ?? [0, 0, 0])))
    _m.compose(_p.set(...pos), _q, _s)
    return scaleUv(geo, rx, ry).applyMatrix4(_m)
  }
  if (shape === 'cyl') {
    const seg = s[0] > 6 ? 28 : 16
    return [place(new CylinderGeometry((s[2] ?? s[0]) / 2, s[0] / 2, s[1], seg), p, r)]
  }
  if (shape === 'cap') {
    const g = new SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2)
    g.scale(s[0] / 2, s[1], s[2] / 2)
    return [place(g, p)]
  }
  if (shape === 'dome') {
    return [
      place(new CylinderGeometry(s[0] / 2, s[0] / 2, s[1] / 2, 20), [p[0], s[1] / 4, p[2]]),
      place(new SphereGeometry(s[0] / 2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), [p[0], s[1] / 2, p[2]]),
    ]
  }
  return [place(new BoxGeometry(s[0], s[1], s[2]), p, r)]
}

/** The glowing neon edges drawn round every wall-run wall. */
function wallrunEdges(sd) {
  const { p, s, r } = sd
  const out = []
  const edge = (lp, size) => {
    const g = new BoxGeometry(...size)
    _q.setFromEuler(_e.set(...(r ?? [0, 0, 0])))
    const local = new Vector3(...lp).applyQuaternion(_q)
    _m.compose(_p.set(p[0] + local.x, p[1] + local.y, p[2] + local.z), _q, _s)
    out.push(g.applyMatrix4(_m))
  }
  for (const e of [-1, 1]) {
    edge([0, (e * s[1]) / 2, 0], [s[0] + 0.12, 0.18, s[2] + 0.12])
    edge([0, 0, (e * s[2]) / 2], [s[0] + 0.12, s[1], 0.18])
  }
  return out
}

const textureCache = new Map()
function baseTexture(tex) {
  if (!textureCache.has(tex)) textureCache.set(tex, getTexture(tex, 1, 1))
  return textureCache.get(tex)
}

function materialFor(key, sd) {
  if (key === 'neon') return new MeshBasicMaterial({ color: '#46ff5a', toneMapped: false })
  const transparent = sd.opacity !== undefined && sd.opacity < 1
  return new MeshStandardMaterial({
    color: sd.c,
    map: sd.tex ? baseTexture(sd.tex) : null,
    roughness: 0.85,
    transparent,
    opacity: sd.opacity ?? 1,
    depthWrite: !transparent,
    emissive: sd.emissive || '#000000',
    emissiveIntensity: sd.emissive ? (sd.ei ?? 0.6) : 0,
    alphaTest: sd.alpha ? 0.5 : 0,
    side: sd.alpha ? DoubleSide : FrontSide,
  })
}

export function MergedSolids({ solids }) {
  const meshes = useMemo(() => {
    const groups = new Map()
    const add = (key, sd, geos) => {
      if (!groups.has(key)) groups.set(key, { sd, geos: [] })
      groups.get(key).geos.push(...geos)
    }
    for (const sd of solids) {
      const key = [sd.c, sd.tex, sd.opacity, sd.emissive, sd.ei, sd.alpha].join('|')
      add(key, sd, geometriesFor(sd))
      if (sd.wallrun) add('neon', sd, wallrunEdges(sd))
    }
    const out = []
    for (const [key, { sd, geos }] of groups) {
      const geometry = mergeGeometries(geos, false)
      geos.forEach((g) => g.dispose())
      if (!geometry) continue
      geometry.computeBoundingSphere()
      const transparent = key !== 'neon' && sd.opacity !== undefined && sd.opacity < 1
      out.push({
        key,
        geometry,
        material: materialFor(key, sd),
        cast: key !== 'neon' && !transparent && !sd.alpha,
      })
    }
    return out
  }, [solids])

  useEffect(
    () => () => {
      for (const m of meshes) {
        m.geometry.dispose()
        m.material.dispose()
      }
    },
    [meshes],
  )

  return meshes.map((m) => (
    <mesh key={m.key} geometry={m.geometry} material={m.material} castShadow={m.cast} receiveShadow />
  ))
}

export default MergedSolids
