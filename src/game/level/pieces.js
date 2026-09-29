import { PRODUCTS, STAGE_LEVEL, STAGE_WINS } from '../config'
import { fmt } from '../format'

/**
 * Reusable level pieces shared by the lobby and the stage builders.
 * Every function takes the builder `B` and appends plain data to it.
 */

/** Half width of the running course. Scenery starts just outside it. */
export const HALF = 20

/** Default roof colours for village houses; stages can pass their own. */
const ROOFS = ['#e8872a', '#c8483a', '#e8872a', '#3a78c8', '#e8872a', '#5aa04a']

/** `pal`: 'green' (default), 'sakura' (pink blossom) or 'autumn'. */
export function tree(B, x, z, scale = 1, y = 0, pal) {
  B.W.trees.push({ p: [x, y, z], s: scale, pal })
}

/** Red torii gate spanning the path at `z`, centred on `x`. */
export function torii(B, x, z, color, width = 16, height = 9) {
  const half = width / 2
  B.box(x - half, height / 2, z, 1, height, 1, color)
  B.box(x + half, height / 2, z, 1, height, 1, color)
  B.box(x, height - 0.6, z, width + 2.5, 0.8, 1.2, color, { col: false })
  B.box(x, height + 0.3, z, width + 4, 0.6, 1.6, '#2a1a1a', { col: false })
  B.box(x, height - 2.2, z, width, 0.5, 0.8, color, { col: false })
}

/** Stone tōrō lantern with a warm glowing lamp. */
export function lantern(B, x, z, y = 0, col = false) {
  B.box(x, y + 0.2, z, 1, 0.4, 1, '#b9b6ad', { tex: 'stone', col })
  B.box(x, y + 1, z, 0.4, 1.3, 0.4, '#b9b6ad', { col: false })
  B.box(x, y + 1.95, z, 0.85, 0.65, 0.85, '#ffd27a', { col: false, emissive: '#ffb84a', ei: 1.6 })
  B.box(x, y + 2.4, z, 1.3, 0.24, 1.3, '#6f6c66', { col: false })
  B.box(x, y + 2.62, z, 0.3, 0.25, 0.3, '#6f6c66', { col: false })
}

/** A tiered pagoda: red pillars, cream walls, dark tiled roofs, gold spire. */
export function pagoda(B, x, z, tiers = 4, roof = '#3a2a2a', scale = 1) {
  const s = scale
  B.box(x, 0.6 * s, z, 10 * s, 1.2 * s, 10 * s, '#b9b6ad', { tex: 'stone', col: false })
  let y = 1.2 * s
  for (let i = 0; i < tiers; i++) {
    const w = (7 - i * 1.1) * s
    const h = 3.2 * s
    B.box(x, y + h / 2, z, w, h, w, '#f3e6c8', { col: false })
    for (const [dx, dz] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]) {
      B.box(x + (dx * w) / 2, y + h / 2, z + (dz * w) / 2, 0.5 * s, h, 0.5 * s, '#c8231c', { col: false })
    }
    y += h
    B.box(x, y + 0.3 * s, z, w + 3.2 * s, 0.6 * s, w + 3.2 * s, roof, { tex: 'roof', col: false })
    B.box(x, y + 0.8 * s, z, w + 1.4 * s, 0.5 * s, w + 1.4 * s, roof, { tex: 'roof', col: false })
    y += 1.1 * s
  }
  B.box(x, y + 1.5 * s, z, 0.35 * s, 3 * s, 0.35 * s, '#e8b22a', { col: false, emissive: '#b88a0a', ei: 0.4 })
}

/** A shrine hall: stone plinth, red columns, wide double roof. */
export function shrine(B, x, z, w = 12, d = 9, roof = '#3a2a2a', facing = 1) {
  B.box(x, 0.5, z, w + 2, 1, d + 2, '#b9b6ad', { tex: 'stone', col: false })
  B.box(x, 3.5, z - facing * 0.8, w, 5, d - 1.6, '#f3e6c8', { tex: 'templeWall', col: false })
  for (let i = 0; i <= 4; i++) {
    B.box(x - w / 2 + (i * w) / 4, 3.5, z + facing * (d / 2 - 0.3), 0.6, 5, 0.6, '#c8231c', { col: false })
  }
  B.box(x, 6.4, z, w + 3, 0.7, d + 3, roof, { tex: 'roof', col: false })
  B.box(x, 7.2, z, w + 0.5, 1, d + 0.2, roof, { tex: 'roof', col: false })
  B.box(x, 8, z, w - 3, 0.6, 1, '#e8b22a', { col: false })
  lantern(B, x - w / 2 - 2, z + facing * (d / 2 + 2))
  lantern(B, x + w / 2 + 2, z + facing * (d / 2 + 2))
}

/**
 * Stage entrance: torii, portal sheet, title, the recommended speed, checkpoint and
 * respawn point.
 */
export function stageGate(B, ctx, z, n, sub, color = '#7c4dff') {
  const { ox, world } = ctx
  // Sandstone gateway with a glowing portal sheet, like the original's stage doors.
  const stone = world === 2 ? '#d9b27a' : '#d6ccb2'
  const px = HALF - 3
  for (const side of [-1, 1]) {
    B.box(ox + side * px, 6, z, 3, 12, 3, stone, { tex: 'stone' })
    B.box(ox + side * px, 12.4, z, 3.8, 0.8, 3.8, '#8e8574', { col: false })
    B.box(ox + side * px, 0.4, z, 3.8, 0.8, 3.8, '#8e8574', { col: false })
  }
  B.box(ox, 13.2, z, px * 2 + 4, 2.4, 3.4, stone, { tex: 'stone', col: false })
  B.box(ox, 14.7, z, px * 2 + 5.5, 0.6, 4.2, '#8e8574', { col: false })
  B.label(`Stage ${n}`, [ox, 8.6, z + 0.9], { size: 2.8, color: '#ffffff', outline: '#3a2a6a' })
  if (sub) B.label(sub, [ox, 6.7, z + 0.9], { size: 1.05, color: '#ffffff', outline: '#2a2a2a' })
  const req = STAGE_LEVEL[world]?.[n - 1] ?? 1
  if (req > 1) {
    B.label(`Level ${req} Required`, [ox, 5.05, z + 0.9], { size: 0.55, color: '#ffe23a', outline: '#3a2a00' })
  }
  lantern(B, ox - (HALF - 0.8), z + 2)
  lantern(B, ox + (HALF - 0.8), z + 2)
  bunting(B, ox, z - 14, 11.5)

  // The glowing sheet between the pillars; below `req` it turns into a locked barrier.
  B.W.gates.push({ p: [ox, 0, z - 0.1], w: px * 2 - 3, h: 12, color, req, stage: n, world })
  B.trigger('checkpoint', [ox - HALF, -2, z - 5], [ox + HALF, 20, z - 0.5], { world, stage: n, req })
  B.W.spawns[world][n] = { pos: [ox, 1.2, z - 12], yaw: 0 }
}

/**
 * End of a stage: one big gold pad in the middle that pays out and sends you to the
 * lobby the moment you step on it, plus a small "Wins x2 Forever" shop pad aside.
 */
export function endPads(B, ctx, z, n, y = 0) {
  const { ox, world } = ctx
  const wins = STAGE_WINS[world][n - 1]
  const lb = { billboard: true }
  // Tucked into the right-hand corner by the next gate, so the path stays clear.
  z -= 5
  const px = ox + HALF - 6
  B.W.pads.push({ p: [px, y, z], size: [4.6, 4.6], color: '#ffd21f', kind: 'win' })
  B.W.props.push({ kind: 'beam', p: [px, y, z], color: '#ffe23a', scale: 0.7 })
  B.label(`+${fmt(wins)} Win${wins === 1 ? '' : 's'}`, [px, y + 3.8, z], { ...lb, size: 1.1, color: '#ffe23a', outline: '#5a3a00' })
  B.label('Step on it to collect!', [px, y + 2.9, z], { ...lb, size: 0.5, color: '#ffffff', outline: '#1a1a1a' })
  B.trigger('win', [px - 2.4, y - 1, z - 2.4], [px + 2.4, y + 3, z + 2.4], { world, stage: n, wins })

  const bx = ox - (HALF - 5)
  B.W.pads.push({ p: [bx, y, z], size: [3.6, 3.6], color: '#27e04a', kind: 'buy' })
  B.label('Wins x2', [bx, y + 3, z], { ...lb, size: 0.8, color: '#ffe23a', outline: '#5a3a00' })
  B.label(`Forever - ${fmt(PRODUCTS.x2wins.price)} Wins`, [bx, y + 2.3, z], { ...lb, size: 0.5, color: '#ff3a2a', outline: '#3a0a00' })
  B.trigger('buyPad', [bx - 1.9, y - 1, z - 1.9], [bx + 1.9, y + 3, z + 1.9], { product: 'x2wins' })
}

/** Course floor slab from `zStart` running `len` toward -Z; returns the far end. */
export function floor(B, ctx, zStart, len, top, color, tex, width = HALF * 2) {
  const { ox } = ctx
  B.slab(ox - width / 2, ox + width / 2, zStart, zStart - len, top, top + 12, color, { tex })
  // Stone cliff under the grass / sand, so every floor stands high out of the pits.
  B.slab(ox - width / 2 - 0.15, ox + width / 2 + 0.15, zStart + 0.15, zStart - len - 0.15, top - 0.6, top + 11.4, '#8a8478', {
    tex: 'stone',
    col: false,
  })
  if (len >= 18 && width >= HALF * 2) ninjaDecor(B, ctx, zStart, len, top)
  return zStart - len
}

/**
 * Ninja training gear along the edges of a floor: straw dummies, kunai stuck in the
 * ground and scroll racks. Visual only, kept to the outer edge of the lane.
 */
function ninjaDecor(B, ctx, zStart, len, top) {
  const { ox } = ctx
  const mid = zStart - len / 2
  const side = (Math.round(zStart) & 2) === 0 ? -1 : 1
  const x = ox + side * (HALF - 2.2)
  // Training dummy: post, straw body, cross-arm and a red headband.
  B.box(x, top + 1.1, mid + 3, 0.35, 2.2, 0.35, '#7a4a22', { col: false, shape: 'cyl' })
  B.box(x, top + 1.7, mid + 3, 0.9, 1.1, 0.9, '#d9b36a', { col: false, shape: 'cyl' })
  B.box(x, top + 1.9, mid + 3, 2.2, 0.22, 0.22, '#7a4a22', { col: false })
  B.box(x, top + 2.55, mid + 3, 0.7, 0.55, 0.7, '#e8cf94', { col: false })
  B.box(x, top + 2.55, mid + 3, 0.76, 0.14, 0.76, '#c8231c', { col: false })
  // Scroll rack: two posts, a bar and three hanging scrolls.
  const xr = ox - side * (HALF - 2.2)
  for (const dz of [-1.4, 1.4]) B.box(xr, top + 1.2, mid - 3 + dz, 0.2, 2.4, 0.2, '#5a3418', { col: false })
  B.box(xr, top + 2.35, mid - 3, 0.2, 0.2, 3.2, '#5a3418', { col: false })
  for (const [i, c] of ['#f2e2b8', '#e8cf94', '#f2e2b8'].entries()) {
    B.box(xr, top + 1.55, mid - 4 + i, 0.08, 1.4, 0.7, c, { col: false })
    B.box(xr, top + 2.25, mid - 4 + i, 0.14, 0.14, 0.8, '#8a1a14', { col: false, shape: 'cyl', r: [Math.PI / 2, 0, 0] })
  }
  // A pair of kunai thrown into the ground.
  B.W.props.push({ kind: 'kunai', p: [x - side * 1.6, top + 0.2, mid - 5], yaw: 0.6 })
  B.W.props.push({ kind: 'kunai', p: [xr + side * 1.8, top + 0.2, mid + 6], yaw: -0.8 })
}

/** Dark bottom of a pit, so gaps read as deep drops. */
export const LIQUID_Y = -10

export function pitBottom(B, ctx, zStart, len) {
  const { ox } = ctx
  const lava = (ctx.n ?? 1) % 2 === 0
  const zEnd = zStart - len
  B.W.water.push({ p: [ox, LIQUID_Y, zStart - len / 2], s: [HALF * 2 + 4, len], lava })
  B.trigger('kill', [ox - HALF - 2, -40, zEnd], [ox + HALF + 2, LIQUID_Y + 0.5, zStart], { lava })
  for (const side of [-1, 1]) {
    B.slab(ox + side * (HALF + 0.5), ox + side * (HALF + 2.5), zStart, zEnd, 1, 13, lava ? '#5a4a44' : '#7d7a70', { tex: 'stone', col: false })
  }
}

/** A rope of little triangle flags strung across the street at `z`. */
export function bunting(B, x, z, y = 11, half = HALF + 2) {
  B.W.bunting.push({ x0: x - half, x1: x + half, y, z })
}

/** Red cloth banner with kanji hanging from a pole, at the edge of the course. */
export function banner(B, x, z, side, yellow = false) {
  B.box(x, 3.4, z, 0.25, 6.8, 0.25, '#5a3a22', { col: false, shape: 'cyl' })
  B.box(x, 6.7, z + side * 0.9, 0.2, 0.2, 2, '#5a3a22', { col: false })
  B.box(x - side * 0.02, 4.4, z + side * 0.9, 0.08, 4, 1.7, '#ffffff', {
    col: false,
    tex: yellow ? 'bannerYellow' : 'banner',
    rep: [1, 1],
  })
}

/** Konoha block: plaster over a stone base, wooden floor bands, orange tiled roofs. */
function konohaBlock(B, x, z, w, h, d, roof, side) {
  B.box(x, 0.7, z, w + 0.4, 1.4, d + 0.4, '#b9b3a3', { tex: 'stone', col: false })
  B.box(x, h / 2 + 0.7, z, w, h - 1.4, d, '#efe4c8', { tex: 'building', col: false })
  for (let y = 5; y < h - 1; y += 4.5) B.box(x, y, z, w + 0.2, 0.3, d + 0.2, '#8a5a3a', { col: false })
  // Sloped roof: overhanging eave, then two narrower tiers.
  B.box(x, h + 0.3, z, w + 1.8, 0.5, d + 1.8, roof, { tex: 'roof', col: false })
  B.box(x, h + 0.9, z, w + 0.6, 0.7, d + 0.6, roof, { tex: 'roof', col: false })
  B.box(x, h + 1.6, z, w * 0.55, 0.7, d - 1, roof, { tex: 'roof', col: false })
  // A shop sign with kanji facing the street on some of them.
  if ((Math.round(z) & 1) === 0) {
    B.box(x - side * (w / 2 + 0.1), 3.4, z, 0.1, 1.6, Math.min(d - 2, 7), '#ffffff', {
      col: false,
      tex: (Math.round(z) & 2) === 0 ? 'banner' : 'bannerYellow',
      rep: [1, 0.4],
    })
  }
  if ((Math.round(x * 3 + z) & 3) === 0) {
    B.box(x + w * 0.2, h + 2.8, z, 1.8, 1.8, 1.8, '#9aa0a8', { col: false, shape: 'cyl' })
  }
}

/** One of Konoha's white round towers with window bands and a red dome roof. */
export function roundTower(B, x, z, d = 12, h = 20, roof = '#c8483a') {
  B.box(x, h / 2, z, d, h, d, '#ffffff', { col: false, shape: 'cyl', tex: 'towerBands', rep: [4, h / 7] })
  B.box(x, h + 0.3, z, d + 1.2, 0.6, d + 1.2, roof, { col: false, shape: 'cyl' })
  B.box(x, h + 0.6, z, d + 0.6, d * 0.28, d + 0.6, roof, { col: false, shape: 'cap' })
}

/** The Hokage building: a great red drum with orange roof rings and the fire sign. */
export function hokageTower(B, x, z, face = 1) {
  B.box(x, 9, z, 30, 18, 30, '#d8412e', { col: false, shape: 'cyl' })
  B.box(x, 18.6, z, 34, 1.2, 34, '#f08a2a', { col: false, shape: 'cyl' })
  B.box(x, 22.5, z, 22, 7, 22, '#d8412e', { col: false, shape: 'cyl' })
  B.box(x, 26.3, z, 25, 1, 25, '#f08a2a', { col: false, shape: 'cyl' })
  B.box(x, 26.6, z, 23, 6, 23, '#f08a2a', { col: false, shape: 'cap' })
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    B.box(x + Math.cos(a) * 15.1, 9, z + Math.sin(a) * 15.1, 1.2, 3, 0.4, '#2a2a3a', {
      col: false,
      r: [0, -a + Math.PI / 2, 0],
    })
  }
  B.box(x, 22.5, z + face * 11.2, 5, 5, 0.3, '#ffffff', { col: false, tex: 'fireSign', rep: [1, 1], alpha: true })
}

/** Giant grey stone gateway, like the monuments towering over the original's stages. */
function monument(B, x, z) {
  B.box(x - 7, 15, z, 5, 30, 5, '#a9a8a4', { tex: 'stone', col: false })
  B.box(x + 7, 15, z, 5, 30, 5, '#a9a8a4', { tex: 'stone', col: false })
  B.box(x, 31, z, 24, 4, 7, '#a9a8a4', { tex: 'stone', col: false })
  B.box(x, 33.6, z, 18, 1.2, 9, '#8e8c88', { col: false })
}

/** A row of Konoha buildings (or temples) along one side of the course. */
function villageRow(B, ctx, zFrom, zTo, side, roofs, temples) {
  const { ox } = ctx
  let z = zFrom
  let i = 0
  while (z > zTo) {
    const kind = temples ? i % 3 : [0, 3, 0, 0, 3, 4][i % 6]
    if (kind === 1) {
      const zc = z - 7
      pagoda(B, ox + side * (HALF + 9), zc, 3 + (i % 2), i % 2 ? '#2a3a5a' : '#3a2a2a')
      tree(B, ox + side * (HALF + 3), zc + 4, 0.9, 0, 'sakura')
      z -= 14
    } else if (kind === 2) {
      const zc = z - 7
      shrine(B, ox + side * (HALF + 11), zc, 12, 9, roofs[(i + 1) % roofs.length], 1)
      z -= 16
    } else if (kind === 3) {
      const d = 10 + (i % 3) * 2
      roundTower(B, ox + side * (HALF + 4 + d / 2), z - d / 2 - 1, d, 16 + ((i * 7) % 12), i % 2 ? '#c8483a' : '#b8453a')
      z -= d + 3
    } else if (kind === 4) {
      monument(B, ox + side * (HALF + 30), z - 6)
      tree(B, ox + side * (HALF + 5), z - 4, 1.1)
      z -= 12
    } else {
      const len = 14 + ((i * 7) % 6)
      const h = 9 + ((i * 5) % 10)
      const depth = 10 + ((i * 3) % 5)
      konohaBlock(B, ox + side * (HALF + 3 + depth / 2), z - len / 2, depth, h, len - 1, roofs[i % roofs.length], side)
      // Taller buildings behind the first row give the street depth.
      if (i % 2 === 0) {
        konohaBlock(B, ox + side * (HALF + 17 + depth / 2), z - len / 2 - 3, depth + 2, h + 7, len - 3, roofs[(i + 2) % roofs.length], side)
      }
      z -= len
    }
    i += 1
  }
}

/** Wooden fences and banners marking the edges of the course through town. */
function streetEdges(B, ctx, zFrom, zTo) {
  const { ox } = ctx
  const zMax = Math.max(zFrom, zTo)
  const zMin = Math.min(zFrom, zTo)
  for (const side of [-1, 1]) {
    B.slab(ox + side * (HALF + 0.9), ox + side * (HALF + 1.2), zMax, zMin, 2.2, 2.2, '#ffffff', { tex: 'fence', col: false })
  }
  let i = 0
  for (let z = zMax - 6; z > zMin + 3; z -= 16) {
    banner(B, ox + (i % 2 ? 1 : -1) * (HALF + 0.6), z, i % 2 ? 1 : -1, i % 3 === 2)
    i += 1
  }
  for (let z = zMax - 12; z > zMin + 6; z -= 26) bunting(B, ox, z, 10.5 + (i++ % 2))
}

/**
 * Side scenery for a stretch of course.
 *   'land'   - grass and a Konoha village (o.roofs picks roof colours)
 *   'temple' - pagodas, shrines, lanterns and blossom trees
 *   'water'  - a river (lethal below y -1.3 unless `o.kill` is false) with grass banks
 *   'forest' - dense trees (o.pal: 'sakura' / 'autumn' for colour)
 *   'canyon' - tall rock walls with trees on top
 */
export function surroundings(B, ctx, zFrom, zTo, kind, o = {}) {
  const { ox, T } = ctx
  const len = Math.abs(zTo - zFrom)
  const mid = (zFrom + zTo) / 2
  const zMin = Math.min(zFrom, zTo)
  const zMax = Math.max(zFrom, zTo)
  const grass = () => {
    B.slab(ox - 75, ox - HALF, zFrom, zTo, 0, 2, T.grass, { tex: 'grass', col: false })
    B.slab(ox + HALF, ox + 75, zFrom, zTo, 0, 2, T.grass, { tex: 'grass', col: false })
  }
  if (kind === 'water' && o.banks === false) {
    B.W.water.push({ p: [ox, o.level ?? -1.4, mid], s: [400, len] })
    if (o.kill !== false) B.trigger('kill', [ox - 200, -30, zMin], [ox + 200, -1.3, zMax])
  } else if (kind === 'water') {
    B.W.water.push({ p: [ox, o.level ?? -1.4, mid], s: [150, len] })
    if (o.kill !== false) B.trigger('kill', [ox - 75, -30, zMin], [ox + 75, -1.3, zMax])
    B.slab(ox - 95, ox - 48, zFrom, zTo, 0, 2, T.grass, { tex: 'grass', col: false })
    B.slab(ox + 48, ox + 95, zFrom, zTo, 0, 2, T.grass, { tex: 'grass', col: false })
    for (let z = zMax - 6; z > zMin; z -= 14) {
      tree(B, ox - 53, z, 1.3, 0, o.pal)
      tree(B, ox + 53, z - 7, 1.3, 0, o.pal)
    }
  } else if (kind === 'forest') {
    grass()
    let i = 0
    for (let z = zMax - 3; z > zMin; z -= 5.5) {
      for (const side of [-1, 1]) {
        const off = ((i * 7 + (side > 0 ? 3 : 0)) % 5) * 2.2
        const pal = o.pal ?? (i % 7 === 3 ? 'sakura' : undefined)
        tree(B, ox + side * (HALF + 4 + off), z, 1.3 + ((i * 3) % 4) * 0.15, 0, pal)
        tree(B, ox + side * (HALF + 16 + off), z - 2.5, 1.6 + ((i * 5) % 3) * 0.2, 0, o.pal)
      }
      i += 1
    }
  } else if (kind === 'canyon') {
    const h = o.height ?? 22
    for (const side of [-1, 1]) {
      B.slab(ox + side * (HALF + 1), ox + side * (HALF + 18), zFrom, zTo, h, h + 16, o.color ?? '#a88563', { tex: 'stone', col: false })
      for (let z = zMax - 5; z > zMin; z -= 9) tree(B, ox + side * (HALF + 7 + ((z * 3) & 3)), z, 1.1, h, o.pal)
    }
  } else if (kind === 'temple') {
    grass()
    streetEdges(B, ctx, zFrom, zTo)
    villageRow(B, ctx, zFrom, zTo, -1, o.roofs ?? ROOFS, true)
    villageRow(B, ctx, zFrom - 7, zTo, 1, o.roofs ?? ROOFS, true)
    for (let z = zMax - 4; z > zMin; z -= 12) {
      lantern(B, ox - HALF - 1.5, z)
      lantern(B, ox + HALF + 1.5, z - 6)
    }
  } else {
    grass()
    streetEdges(B, ctx, zFrom, zTo)
    villageRow(B, ctx, zFrom, zTo, -1, o.roofs ?? ROOFS, false)
    villageRow(B, ctx, zFrom - 5, zTo, 1, o.roofs ?? ROOFS, false)
  }
}
