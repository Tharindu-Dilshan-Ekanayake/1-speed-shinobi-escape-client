import { useLayoutEffect } from 'react'
import { Matrix4, Mesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Merges the many little meshes of a block model into one mesh per material.
 *
 * A shinobi is ~70 boxes and cones; sixteen of them on the lobby pedestals would be
 * over a thousand draw calls. Baking each animated part (a leg, an arm, the head...)
 * leaves about a dozen per character, and the parts still move independently.
 *
 * Meshes under an object flagged `userData.bakeBoundary` (a limb that animates on
 * its own) are left for that limb's own bake. Points (sparkles) and anything that
 * animates itself should sit behind a boundary too.
 */

const _inv = new Matrix4()
const _rel = new Matrix4()

function collect(root, out) {
  for (const child of root.children) {
    if (child.userData.bakeBoundary || child.userData.baked) continue
    if (child.isMesh && !child.isInstancedMesh && !child.isSkinnedMesh && child.visible && !child.geometry.isInstancedBufferGeometry) {
      out.push(child)
    }
    collect(child, out)
  }
}

/** Bakes `ref.current`'s own meshes. Re-bakes whenever `key` changes. */
export function useBake(ref, key) {
  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return undefined
    root.updateWorldMatrix(true, true)
    _inv.copy(root.matrixWorld).invert()

    const meshes = []
    collect(root, meshes)
    const byMaterial = new Map()
    for (const m of meshes) {
      if (!byMaterial.has(m.material)) byMaterial.set(m.material, [])
      byMaterial.get(m.material).push(m)
    }

    const added = []
    const hidden = []
    for (const [material, list] of byMaterial) {
      if (list.length < 2) continue
      const geos = list.map((m) => {
        _rel.multiplyMatrices(_inv, m.matrixWorld)
        // Everything goes non-indexed so boxes, cones and rounded boxes can merge.
        const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
        const g = src.applyMatrix4(_rel)
        // mergeGeometries needs identical attribute sets.
        for (const name of Object.keys(g.attributes)) {
          if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name)
        }
        return g
      })
      const merged = mergeGeometries(geos, false)
      geos.forEach((g) => g.dispose())
      if (!merged) continue
      const mesh = new Mesh(merged, material)
      mesh.castShadow = list.some((m) => m.castShadow)
      mesh.receiveShadow = true
      mesh.userData.baked = true
      root.add(mesh)
      added.push(mesh)
      for (const m of list) {
        m.visible = false
        hidden.push(m)
      }
    }

    return () => {
      for (const m of added) {
        root.remove(m)
        m.geometry.dispose()
      }
      for (const m of hidden) m.visible = true
    }
  }, [ref, key])
}
