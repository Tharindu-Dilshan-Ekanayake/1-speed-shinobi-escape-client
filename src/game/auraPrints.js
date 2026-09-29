import { Color, InstancedBufferAttribute, Object3D } from 'three'

/**
 * The shared pool of glowing footprints (drawn by <FootPrints> in Aura.jsx). Any
 * player - you or anyone in the lobby - leaves prints with emitPrint().
 */

export const PRINTS = 280
/** Seconds a footprint glows before it has fully faded. */
export const PRINT_LIFE = 3.4
export const clock = () => performance.now() / 1000

export const printState = {
  mesh: null,
  next: 0,
  birth: new InstancedBufferAttribute(new Float32Array(PRINTS).fill(-99), 1),
  color: new InstancedBufferAttribute(new Float32Array(PRINTS * 3).fill(1), 3),
}

const _obj = new Object3D()
const _col = new Color()

/**
 * Leaves one glowing footprint. `yaw` is the walking direction (0 = +Z) and `side`
 * -1 / 1 picks the left or right foot.
 */
export function emitPrint(x, y, z, yaw, side, color) {
  const m = printState.mesh
  if (!m) return
  const i = printState.next++ % PRINTS
  const rx = Math.cos(yaw)
  const rz = -Math.sin(yaw)
  _obj.position.set(x + rx * side * 0.17, y + 0.035, z + rz * side * 0.17)
  _obj.rotation.set(0, yaw + Math.PI, 0)
  // Mirrored for the left foot, so the big toe is always on the inside.
  _obj.scale.set(side > 0 ? -1 : 1, 1, 1)
  _obj.updateMatrix()
  m.setMatrixAt(i, _obj.matrix)
  m.instanceMatrix.needsUpdate = true
  printState.birth.array[i] = clock()
  printState.birth.needsUpdate = true
  _col.set(color)
  printState.color.setXYZ(i, _col.r, _col.g, _col.b)
  printState.color.needsUpdate = true
}
