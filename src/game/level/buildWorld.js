import { CHARACTERS, TREADMILLS } from '../config'
import { HALF, torii, tree } from './pieces'
import { buildStages, STAGE_INFO, WORLD_STAGES } from './stages'

/**
 * Procedural level description: the lobby, then the stages (see stages.js) running
 * off toward -Z, for each world. Everything is plain data; Level.jsx turns it into meshes and
 * colliders, and the player loop tests its position against `triggers` (axis-aligned
 * boxes) every frame. Keeping triggers as data instead of Rapier sensor callbacks
 * makes them deterministic and trivial to debug.
 *
 * Units: 1 unit ~= 2.8 Roblox studs. Ground top is y = 0. The player faces -Z when
 * walking "forward" into the stages; the lobby spawn sits at +Z.
 */

const THEMES = {
  leaf: {
    ground: '#e9d49a',
    grass: '#55c73a',
    path: '#ecd494',
    wallCap: '#c9c6bc',
    vip: '#5b3fa8',
    vipCap: '#ffd45a',
    wood: '#a0602f',
    stone: '#a9aab0',
    wall: '#a3a29b',
    building: '#eadfc4',
    roof: '#c8483a',
    hall: '#c9362c',
    hallFloor: '#c8c8c8',
    gate: '#c8231c',
    dark: '#1e2a44',
  },
  sand: {
    ground: '#f2c27a',
    grass: '#e2b25e',
    path: '#f4d59a',
    wallCap: '#e8c48a',
    vip: '#8a4a1e',
    vipCap: '#ffd45a',
    wood: '#8e5a2c',
    stone: '#c9924f',
    wall: '#d49c58',
    building: '#e9bd7e',
    roof: '#b56a2b',
    hall: '#b8582a',
    hallFloor: '#d9b98c',
    gate: '#a8321c',
    dark: '#3a2a1e',
  },
}

/** Stages per world: 20 in the Hidden Leaf, 8 in the Hidden Sand. */
export const STAGE_COUNTS = Object.fromEntries(Object.entries(WORLD_STAGES).map(([w, l]) => [w, l.length]))
export const stageCount = (world) => STAGE_COUNTS[world] ?? 8

/** `{ name, ninja }` of a stage, or null for the lobby. */
export function stageInfo(world, stage) {
  const key = WORLD_STAGES[world]?.[stage - 1]
  return key ? STAGE_INFO[key] : null
}
export const WORLD_ORIGIN_X = { 1: 0, 2: 1000 }

function createBuilder() {
  const W = {
    solids: [],
    triggers: [],
    labels: [],
    pedestals: [],
    treadmills: [],
    pads: [],
    trees: [],
    bushes: [],
    water: [],
    spinners: [],
    boards: [],
    gates: [],
    chests: [],
    props: [],
    movers: [],
    blinkers: [],
    breakables: [],
    hazards: [],
    pulses: [],
    topplers: [],
    crushers: [],
    bunting: [],
    spawns: { 1: [], 2: [] },
  }
  let nextId = 0
  let chunk = 'none'
  /** Arrays whose items belong to a chunk (trees/bushes are one instanced mesh). */
  const CHUNKED = ['solids', 'labels', 'pedestals', 'treadmills', 'pads', 'water', 'spinners', 'boards', 'gates',
    'chests', 'props', 'movers', 'blinkers', 'breakables', 'hazards', 'pulses', 'topplers', 'crushers']
  const tagPending = () => {
    for (const key of CHUNKED) {
      for (let i = W[key].length - 1; i >= 0 && W[key][i].ch === undefined; i--) W[key][i].ch = chunk
    }
  }

  const api = {
    W,
    /** Everything added from now on renders as part of chunk `key`. */
    beginChunk(key) {
      tagPending()
      chunk = key
    },
    endChunks() {
      tagPending()
    },
    /** Box by centre + size. */
    box(x, y, z, sx, sy, sz, c, o = {}) {
      W.solids.push({ p: [x, y, z], s: [sx, sy, sz], c, col: true, vis: true, ...o })
    },
    /** Box by x/z extents with its top face at `top`. zA/zB can be in any order. */
    slab(x0, x1, zA, zB, top, thick, c, o = {}) {
      const sx = Math.abs(x1 - x0)
      const sz = Math.abs(zB - zA)
      api.box((x0 + x1) / 2, top - thick / 2, (zA + zB) / 2, sx, thick, sz, c, o)
    },
    trigger(type, min, max, data = {}) {
      const t = { id: nextId++, type, min, max, data }
      W.triggers.push(t)
      return t
    },
    label(text, p, o = {}) {
      W.labels.push({ text, p, size: 1, color: '#ffffff', ...o })
    },
  }
  return api
}

/* ------------------------------------------------------------------------ */
/* Lobby                                                                     */
/* ------------------------------------------------------------------------ */

/*
 * Lobby layout (x/z relative to the world origin, north = -z = the stages):
 *
 *        wall | char terrace |  STAGE GATE  | char terrace | wall      z = -40
 *             | (6 chars)    |   main path  |  (6 chars)   |
 *   VIP stage |              |      |       |              | treadmills
 *   (4 Bux    |  ---------- cross path ----------------    | (8, facing east)
 *    chars)   |                     |                      |
 *             |                   spawn                    |
 *  jump pads  |                     |              chest   |
 *        wall ------------------ WORLD PORTAL ---------------- wall       z = +42
 */
export const LOBBY = { halfX: 44, north: -40, south: 42 }

/** Stepped stone terrace, rising from `front` toward the opposite edge along `axis`. */
function terrace(B, { x0, x1, z0, z1, axis, front, steps = 3, stepH = 0.5, stepD = 1.6, stone, cap, capTex = 'sand' }) {
  let back
  if (axis === 'z') back = front === z0 ? z1 : z0
  else back = front === x0 ? x1 : x0
  const dir = Math.sign(back - front)
  for (let i = 0; i < steps; i++) {
    const start = front + dir * stepD * i
    const top = stepH * (i + 1)
    if (axis === 'z') B.slab(x0, x1, start, back, top, top, stone, { tex: 'stone' })
    else B.slab(start, back, z0, z1, top, top, stone, { tex: 'stone' })
  }
  const topY = stepH * steps
  const capStart = front + dir * (stepD * (steps - 1) + 0.25)
  const capEnd = back - dir * 0.25
  if (axis === 'z') B.slab(x0 + 0.25, x1 - 0.25, capStart, capEnd, topY + 0.08, 0.08, cap, { tex: capTex, col: false })
  else B.slab(capStart, capEnd, z0 + 0.25, z1 - 0.25, topY + 0.08, 0.08, cap, { tex: capTex, col: false })
  return topY
}

/** A flat sand path decal on the grass (visual only; the grass is the collider). */
let pathLayer = 0

/**
 * Sand path decal. Each path sits a hair above the previous one, so where two
 * paths cross they don't flicker against each other (z-fighting).
 */
function sandPath(B, ctx, x0, x1, z0, z1) {
  const { ox, T } = ctx
  const top = 0.06 + (pathLayer++ % 8) * 0.02
  B.slab(ox + x0, ox + x1, z0, z1, top, 0.1, T.path, { tex: 'sand', col: false })
}

/** Wooden bench running along z; `side` is where the backrest is (+1 = +x). */
function bench(B, x, z, side) {
  B.box(x, 0.55, z, 1.1, 0.16, 3.2, '#b07638', { tex: 'wood' })
  B.box(x + side * 0.5, 1.05, z, 0.16, 0.7, 3.2, '#b07638', { tex: 'wood' })
  for (const dz of [-1.35, 1.35]) B.box(x, 0.25, z + dz, 1, 0.5, 0.18, '#5a3a22', { col: false })
}

/** Stone tōrō lantern with a warm glowing lamp. */
function lantern(B, x, z) {
  B.box(x, 0.2, z, 1, 0.4, 1, '#b9b6ad', { tex: 'stone' })
  B.box(x, 1, z, 0.4, 1.3, 0.4, '#b9b6ad', { col: false })
  B.box(x, 1.95, z, 0.85, 0.65, 0.85, '#ffd27a', { col: false, emissive: '#ffb84a', ei: 1.6 })
  B.box(x, 2.4, z, 1.3, 0.24, 1.3, '#6f6c66', { col: false })
  B.box(x, 2.62, z, 0.3, 0.25, 0.3, '#6f6c66', { col: false })
}

function bush(B, x, z, s = 1) {
  B.W.bushes.push({ p: [x, 0, z], s })
}

function lobbyShell(B, ctx) {
  const { ox, T } = ctx
  const { halfX: H, north: N, south: S } = LOBBY

  // Grass ground (the collider for the whole lobby).
  B.slab(ox - H, ox + H, N, S, 0, 2, T.grass, { tex: 'grass' })

  // Stone walls with a low green lattice fence, open at the stage gate.
  const wallH = 5
  const fenceH = 3
  const wall = (x, z, sx, sz) => {
    B.box(ox + x, wallH / 2, z, sx, wallH, sz, T.wall, { tex: 'stone' })
    B.box(ox + x, wallH + 0.25, z, sx + 0.3, 0.5, sz + 0.3, T.wallCap, { col: false })
    B.box(ox + x, wallH + 0.5 + fenceH / 2, z, sx, fenceH, sz, '#2fb14a', { tex: 'lattice', col: false, alpha: true })
  }
  const gate = 9
  wall(-(H + 0.6), (N + S) / 2, 1.2, S - N + 2.4)
  wall(H + 0.6, (N + S) / 2, 1.2, S - N + 2.4)
  wall(0, S + 0.6, 2 * H + 2.4, 1.2)
  wall(-(H + gate) / 2, N - 0.6, H - gate, 1.2)
  wall((H + gate) / 2, N - 0.6, H - gate, 1.2)

  // Grass outside the walls, then a ring of trees and Konoha houses. Laid in strips
  // round the lobby floor and the stage 1 lane, never under them: two surfaces a hair
  // apart flicker (z-fight) at a distance. North of the lobby it stops where stage 1's
  // first floor ends; past that it is open water.
  const outside = (x0, x1, z0, z1) => B.slab(ox + x0, ox + x1, z0, z1, 0, 2, T.grass, { tex: 'grass', col: false })
  outside(-110, -H, N - 18, S + 60)
  outside(H, 110, N - 18, S + 60)
  outside(-H, H, S, S + 60)
  outside(-H, -HALF, N - 18, N)
  outside(HALF, H, N - 18, N)
  for (let z = N - 4; z <= S + 6; z += 7) {
    tree(B, ox - H - 6 - ((z * 7) & 3), z, 1 + ((z * 13) & 3) * 0.1)
    tree(B, ox + H + 6 + ((z * 3) & 3), z + 3, 1 + ((z * 11) & 3) * 0.1)
  }
  for (let x = -H; x <= H; x += 7) tree(B, ox + x, S + 6 + ((x * 5) & 3), 1.1 + ((x * 3) & 3) * 0.1)
  for (let x = -H; x <= H; x += 6.5) {
    if (Math.abs(x) > 13) tree(B, ox + x, N - 7 - ((x * 3) & 3), 1.1 + ((x * 7) & 3) * 0.1)
  }
  const houses = [
    [-72, -20, 16, 14, 18],
    [-74, 10, 18, 11, 16],
    [-70, 36, 14, 15, 14],
    [72, -24, 16, 12, 18],
    [74, 6, 14, 16, 16],
    [70, 34, 18, 11, 14],
    [-30, 66, 20, 12, 12],
    [0, 70, 16, 17, 14],
    [30, 66, 20, 13, 12],
  ]
  for (const [x, z, w, h, d] of houses) {
    B.box(ox + x, h / 2, z, w, h, d, T.building, { tex: 'building', col: false })
    B.box(ox + x, h + 0.4, z, w + 1, 0.8, d + 1, T.roof, { col: false })
  }

  // Bushes along the inside of the walls.
  for (let z = 24; z <= S - 4; z += 4.5) bush(B, ox - H + 1.4, z, 1)
  for (let x = -H + 3; x <= H - 3; x += 5) {
    if (Math.abs(x) > 8) bush(B, ox + x, S - 1.2, 0.9)
  }
}

/** Eight treadmills along the east wall. Players stand on the belt facing east. */
function treadmillRow(B, ctx) {
  const { ox } = ctx
  const order = ['train1', 'train2', 'x1.5', 'x2', 'x4', 'x5', 'x10', 'x25']
  const x = ox + 35
  order.forEach((id, i) => {
    const def = TREADMILLS.find((t) => t.id === id)
    // Ends short of the north terrace steps (z -24) so nothing overlaps.
    const z = 29.5 - i * 6.6
    B.W.treadmills.push({ def, p: [x, 0, z] })
    // Frame (collides). The belt top at y = 0.3 is low enough to walk onto.
    B.box(x, 0.15, z, 7.6, 0.3, 4.4, '#2b2e35', { vis: false })
    B.box(x + 4.6, 1.2, z, 1, 2.4, 3.6, '#2b2e35', { vis: false })
    B.trigger('treadmill', [x - 3.8, -0.5, z - 2.2], [x + 3.8, 2.5, z + 2.2], { def })
  })
  sandPath(B, ctx, 26.5, LOBBY.halfX, -20.5, 33.5)
}

function worldPortal(B, ctx, target, label, sub) {
  const { ox, T } = ctx
  const z = LOBBY.south - 1.5
  torii(B, ox, z, T.gate, 12, 9)
  // A thin glowing sheet you can see the world through, not a solid white panel.
  B.box(ox, 4.2, z + 0.7, 10, 7, 0.1, '#7c4dff', { col: false, opacity: 0.16, emissive: '#5a2aff' })
  B.label(label, [ox, 5.6, z - 0.2], { size: 1.9, color: '#ff2a1f', outline: '#ffffff', rotY: Math.PI })
  if (sub) B.label(sub, [ox, 3.7, z - 0.2], { size: 1.1, color: '#ffc21f', outline: '#5a3a00', rotY: Math.PI })
  B.trigger('portal', [ox - 5, -1, z - 2], [ox + 5, 8, z + 1], { world: target })
}

function buildWorld1Lobby(B, ctx) {
  const { ox, T, world } = ctx
  const { halfX: H, north: N } = LOBBY
  lobbyShell(B, ctx)

  B.W.spawns[world][0] = { pos: [ox, 1.2, 20], yaw: 0 }

  // Sand paths: the main road to the gate, a cross road, and plazas.
  sandPath(B, ctx, -7, 7, N, LOBBY.south)
  sandPath(B, ctx, -32, 26.5, -7, 3)
  sandPath(B, ctx, -H, H, -27, -21)
  sandPath(B, ctx, -34, -6, 24, 39)
  sandPath(B, ctx, 8, 22, 26, 39)

  // North terraces: the twelve win-unlocked shinobi, in unlock order left to right.
  const north = { z0: N, z1: -24, axis: 'z', front: -24, stone: T.stone, cap: T.path }
  const top = terrace(B, { ...north, x0: ox - H, x1: ox - 8 })
  terrace(B, { ...north, x0: ox + 8, x1: ox + H })
  const left = ['kaito', 'hana', 'ryu', 'mira', 'takeshi', 'suna']
  const right = ['yuki', 'kage', 'akane', 'zephyr', 'nova', 'oro']
  left.forEach((id, i) => pedestal(B, id, [ox - 38.5 + i * 5.5, top, -32.5], 0))
  right.forEach((id, i) => pedestal(B, id, [ox + 11 + i * 5.5, top, -32.5], 0))

  // West VIP stage: the four Bux shinobi, facing the middle of the lobby.
  const vipTop = terrace(B, {
    x0: ox - H,
    x1: ox - 31,
    z0: -17,
    z1: 21,
    axis: 'x',
    front: ox - 31,
    stone: T.vip,
    cap: T.vipCap,
    capTex: 'tiles',
  })
  const vip = ['kitsune', 'tengu', 'dragon', 'spirit']
  vip.forEach((id, i) => pedestal(B, id, [ox - 38.6, vipTop, -11 + i * 9], Math.PI / 2, 'gold'))
  B.label('EXCLUSIVE SHINOBI', [ox - H + 0.2, 8.6, 2], {
    size: 1.5,
    color: '#ffd21f',
    outline: '#5a2a00',
    rotY: Math.PI / 2,
  })

  // Leaderboards tower over the terraces, just behind the north wall.
  B.W.boards.push({ p: [ox - 25, 6.5, N - 2.2], kind: 'wins' })
  B.W.boards.push({ p: [ox + 25, 6.5, N - 2.2], kind: 'speed' })

  treadmillRow(B, ctx)

  // Benches, lanterns and flower bushes along the main road.
  bench(B, ox - 9, 12, -1)
  bench(B, ox + 9, 12, 1)
  bench(B, ox - 9, -14, -1)
  bench(B, ox + 9, -14, 1)
  for (const z of [-19, 5, 25]) {
    lantern(B, ox - 8.5, z)
    lantern(B, ox + 8.5, z)
  }
  for (const [x, z, s] of [
    [-18, 12, 0.9],
    [-22, 15, 0.7],
    [17, 13, 0.9],
    [21, 16, 0.7],
    [-20, -14, 0.8],
    [18, -15, 0.8],
    [-27, 8, 0.7],
    [22, 8, 0.7],
  ]) {
    bush(B, ox + x, z, s)
  }

  B.W.chests.push({ p: [ox + 15, 0, 33] })
  B.trigger('chest', [ox + 12.5, -1, 30.5], [ox + 17.5, 3, 35.5])

  worldPortal(B, ctx, 2, 'World 2', '2 Rebirths Required')
}

function buildWorld2Lobby(B, ctx) {
  const { ox, T, world } = ctx
  const { halfX: H, north: N } = LOBBY
  lobbyShell(B, ctx)
  B.W.spawns[world][0] = { pos: [ox, 1.2, 20], yaw: 0 }

  sandPath(B, ctx, -7, 7, N, LOBBY.south)
  sandPath(B, ctx, -H, 26.5, -7, 3)
  treadmillRow(B, ctx)

  B.label('Hidden Sand Village', [ox, 11, N - 1], { size: 2.4, color: '#ffc21f', outline: '#5a2a00' })
  for (const [x, z] of [
    [-34, -28],
    [-34, 14],
    [-20, 30],
    [18, -28],
  ]) {
    B.W.solids.push({ p: [ox + x, 4, z], s: [10, 8, 10], c: T.building, col: true, vis: true, shape: 'dome' })
  }

  B.W.boards.push({ p: [ox - 25, 6.5, N - 2.2], kind: 'wins' })
  B.W.boards.push({ p: [ox + 25, 6.5, N - 2.2], kind: 'speed' })

  worldPortal(B, ctx, 1, 'World 1', 'Hidden Leaf')
}

/** `style`: 'red' for win-unlocked characters, 'gold' for Bux ones. */
function pedestal(B, id, p, yaw, style = 'red') {
  const def = CHARACTERS.find((c) => c.id === id)
  B.W.pedestals.push({ id, p, yaw, style })
  // The slab itself is solid, so players stand on it when touching.
  B.box(p[0], p[1] + 0.2, p[2], 3.4, 0.4, 3.4, '#000', { vis: false })
  B.trigger('pedestal', [p[0] - 1.9, p[1] - 1, p[2] - 1.9], [p[0] + 1.9, p[1] + 3, p[2] + 1.9], { id, def })
}

/* ------------------------------------------------------------------------ */

export function buildWorld() {
  const B = createBuilder()

  const w1 = { world: 1, ox: WORLD_ORIGIN_X[1], T: THEMES.leaf, k: 1 }
  B.beginChunk('1-0')
  buildWorld1Lobby(B, w1)
  buildStages(B, w1, LOBBY.north)

  const w2 = { world: 2, ox: WORLD_ORIGIN_X[2], T: THEMES.sand, k: 1.35 }
  B.beginChunk('2-0')
  buildWorld2Lobby(B, w2)
  buildStages(B, w2, LOBBY.north)

  B.endChunks()
  return B.W
}

/** Built once and shared: the store needs spawns, the scene needs everything. */
export const LEVEL = buildWorld()

export function spawnFor(world, stage) {
  const list = LEVEL.spawns[world] || LEVEL.spawns[1]
  return list[stage] || list[0]
}
