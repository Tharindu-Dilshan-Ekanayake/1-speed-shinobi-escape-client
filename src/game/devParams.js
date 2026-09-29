import { getGame, useGameStore } from './gameStore'
import { LEVEL } from './level/buildWorld'
import { runtime } from './runtime'

/**
 * Dev-only URL shortcuts for testing (ignored in production builds):
 *   ?stage=3          jump to a stage checkpoint (unlocks it)
 *   ?world=2          switch world first
 *   ?wins=500&speed=2e4&level=100   set stats
 *   ?pos=0,2,-40,0    teleport to x,y,z facing camera yaw
 *   ?panel=trails     open a HUD panel
 *   ?char=kakashi     equip any character
 * Also exposes window.__shinobi = { runtime, getGame, LEVEL } for the console.
 */
export function applyDevParams() {
  if (!import.meta.env.DEV) return
  window.__shinobi = { runtime, getGame, LEVEL }
  const q = new URLSearchParams(window.location.search)
  if (![...q.keys()].length) return

  const num = (k) => (q.has(k) ? Number(q.get(k)) : undefined)
  const patch = {}
  if (num('wins') !== undefined) patch.wins = num('wins')
  if (num('speed') !== undefined) patch.speed = num('speed')
  if (num('level') !== undefined) patch.level = num('level')
  if (q.has('char')) patch.equipped = q.get('char')
  if (Object.keys(patch).length) useGameStore.setState(patch)

  const g = getGame()
  if (num('world') !== undefined) useGameStore.setState({ world: num('world'), stage: 0 })
  if (num('stage') !== undefined) {
    const w = getGame().world
    useGameStore.setState({ maxStage: { ...g.maxStage, [w]: Math.max(g.maxStage[w] || 0, num('stage')) } })
    getGame().goToStage(num('stage'))
  } else if (num('world') !== undefined) {
    getGame().goToStage(0)
  }
  if (q.has('pos')) {
    const [x, y, z, yaw = 0] = q.get('pos').split(',').map(Number)
    runtime.teleport = { pos: [x, y, z], yaw }
    runtime.cameraYaw = yaw
  }
  if (q.has('panel')) useGameStore.setState({ panel: q.get('panel') })
}
