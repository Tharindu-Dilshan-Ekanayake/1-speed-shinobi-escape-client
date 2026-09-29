import { endPads, floor, HALF, lantern, pitBottom, roundTower, stageGate, surroundings, tree } from './pieces'

/**
 * Stage builders. Each takes the builder, the world context and the z of its gate,
 * builds the stage running toward -Z, and returns the z where the next gate goes.
 *
 * World 1 (Hidden Leaf) plays all twenty; World 2 reuses the classic eight with its
 * sand theme. Every stage from 8 on is built around one shinobi's technique.
 */

/** Shown on the stage-reached popup and in docs. Indexed by builder key. */
export const STAGE_INFO = {
  river: { name: 'River Run', ninja: 'Naruto' },
  wallrun: { name: 'Wall Run', ninja: 'Kakashi' },
  tower: { name: 'Temple Run', ninja: 'Hiruzen' },
  hall: { name: 'Hall of Pillars', ninja: 'Tsunade' },
  dash: { name: 'The Great Gap', ninja: 'Minato' },
  logs: { name: 'Training Logs', ninja: 'Naruto' },
  zigzag: { name: 'Zigzag Walls', ninja: 'Sasuke' },
  waterwalk: { name: 'Stepping Stones', ninja: 'Kakashi' },
  hurricane: { name: 'Leaf Hurricane', ninja: 'Rock Lee' },
  raijin: { name: 'Flying Raijin', ninja: 'Minato' },
  toads: { name: 'River Boats', ninja: 'Jiraiya' },
  sand: { name: 'Sand Coffin', ninja: 'Gaara' },
  genjutsu: { name: 'Genjutsu', ninja: 'Itachi' },
  chidori: { name: 'Chidori', ninja: 'Sasuke' },
  shuriken: { name: 'Shuriken Storm', ninja: 'Tenten' },
  shinra: { name: 'Shinra Tensei', ninja: 'Pain' },
  kamui: { name: 'Kamui', ninja: 'Obito' },
  meteor: { name: 'Tengai Shinsei', ninja: 'Madara' },
  valley: { name: 'Valley of the End', ninja: 'Naruto & Sasuke' },
  hokage: { name: 'Hokage Rock', ninja: 'Final' },
}

export const WORLD_STAGES = {
  1: [
    'river', 'wallrun', 'tower', 'hall', 'dash', 'logs', 'zigzag', 'waterwalk', 'hurricane', 'raijin',
    'toads', 'sand', 'genjutsu', 'chidori', 'shuriken', 'shinra', 'kamui', 'meteor', 'valley', 'hokage',
  ],
  2: ['river', 'wallrun', 'tower', 'hall', 'dash', 'logs', 'zigzag', 'hokage'],
}

/* ------------------------------------------------------------------------ */
/* Small helpers                                                             */
/* ------------------------------------------------------------------------ */

/** Grass-topped stone block standing out of a pit or river. */
function pillar(B, ctx, x, zc, w, d, top, stone = '#9a8f7e', cap) {
  const { ox, T } = ctx
  B.slab(ox + x - w / 2, ox + x + w / 2, zc + d / 2, zc - d / 2, top, top + 16, stone, { tex: 'stone' })
  B.slab(ox + x - w / 2 + 0.1, ox + x + w / 2 - 0.1, zc + d / 2 - 0.1, zc - d / 2 + 0.1, top + 0.06, 0.12, cap ?? T.grass, {
    tex: 'grass',
    col: false,
  })
}

/** Rock Lee / toad launch: touching it throws you up and forward. */
function launchPad(B, ctx, x, y, z, vy = 24, push = 20) {
  const { ox } = ctx
  B.W.props.push({ kind: 'launch', p: [ox + x, y, z] })
  B.trigger('launch', [ox + x - 2.3, y - 0.5, z - 2.3], [ox + x + 2.3, y + 2.4, z + 2.3], { vy, push })
}

/**
 * A sign right before a jump that needs a double jump, facing the runner. `y` is the
 * ground height there; the sign floats a few units above it.
 */
function doubleJumpHint(B, x, y, z) {
  B.label('Press [Space] While Jumping to Double Jump', [x, y + 3.6, z], {
    size: 0.85,
    color: '#ffe23a',
    outline: '#2a1a00',
  })
}

/**
 * Teleport trigger. `to` is where the player lands; `back` marks a Kamui trap; `fly`
 * carries the player there on a high arc (Flying Raijin) instead of an instant jump.
 */
function warp(B, x, y, z, to, back = false, fly = false) {
  B.trigger('warp', [x - 1.5, y - 0.5, z - 1.3], [x + 1.5, y + 4, z + 1.3], { to, back, fly })
}

/**
 * An obstacle run on a straight floor: temple walls / pillars / trees that crash
 * across the path as you pass, and stone crushers that slam down on a timer.
 *   { t: 'wall' | 'pillar' | 'tree', dz, side, lead? }  a falling wall
 *   { t: 'crush', dz, x, w?, period?, ph? }             a crusher
 * `dz` is measured from the start of the gauntlet. Returns the far end.
 */
function gauntlet(B, ctx, z, len, items, o = {}) {
  const { ox, T } = ctx
  const start = z
  z = floor(B, ctx, z, len, 0, o.color ?? T.ground, o.tex ?? 'sand')
  for (const it of items) {
    const zc = start - it.dz
    if (it.t === 'crush') {
      const w = it.w ?? 5
      B.W.crushers.push({
        p: [ox + it.x, 0, zc],
        s: [w, 3, w],
        drop: 7,
        period: it.period ?? 3.4,
        ph: it.ph ?? 0,
        kind: o.crushKind ?? 'stone',
      })
    } else {
      const id = B.W.topplers.length
      const w = it.t === 'wall' ? 5 : it.t === 'tree' ? 1.6 : 1.8
      B.W.topplers.push({
        id,
        p: [ox + it.side * (HALF - 0.7), 0, zc],
        h: it.h ?? 17,
        w,
        t: it.t === 'wall' ? 1.2 : 1.6,
        side: it.side,
        kind: it.t,
      })
      // It starts to fall when the player crosses this line, `lead` units before it.
      const tz = zc + (it.lead ?? 15)
      B.trigger('topple', [ox - HALF, -2, tz - 1.5], [ox + HALF, 20, tz + 1.5], { id })
    }
  }
  if (o.warning !== false) {
    B.label('WATCH OUT!', [ox, 0.08, start - 4], { size: 2, color: '#ff4a2a', outline: '#2a0a00', flat: true })
  }
  return z
}

/** A lava pit: glowing floor a few units down, lethal to touch. */
function lavaPit(B, ctx, zStart, len) {
  const { ox } = ctx
  const mid = zStart - len / 2
  B.W.water.push({ p: [ox, -3, mid], s: [HALF * 2 + 2, len], lava: true })
  B.trigger('kill', [ox - HALF - 1, -30, zStart - len], [ox + HALF + 1, -2.6, zStart], { lava: true })
  // Rock rims either side, so the lava sits in a channel.
  for (const side of [-1, 1]) {
    // Starts outside the floors' stone skirts and sits lower, so nothing overlaps.
    B.slab(ox + side * (HALF + 0.3), ox + side * (HALF + 1.8), zStart, zStart - len, -0.25, 4, '#6a5a52', { tex: 'stone', col: false })
  }
}

/**
 * Inside the Hokage building (the original's stage 3): red walls over a white skirting,
 * glowing wall lamps and heavy grey ceiling slabs.
 */
function templeHall(B, ctx, zFrom, zTo, height = 14) {
  const { ox } = ctx
  for (const side of [-1, 1]) {
    B.slab(ox + side * HALF, ox + side * (HALF + 2), zFrom, zTo, height, height, '#d8322a', { tex: 'hall' })
    B.slab(ox + side * (HALF - 0.3), ox + side * HALF, zFrom, zTo, 2.4, 2.4, '#ece6da', { col: false })
    for (let z = zFrom - 6; z > zTo; z -= 10) {
      B.box(ox + side * (HALF - 0.15), 7, z, 0.2, 3.2, 1.2, '#fff4d0', { col: false, emissive: '#ffe8a0', ei: 1.8 })
    }
  }
  for (let z = zFrom - 10; z > zTo + 6; z -= 20) {
    B.box(ox, height + 0.4, z, HALF * 2 + 4, 1.4, 8, '#8e9097', { col: false })
    B.box(ox, height - 0.6, z, HALF * 1.4, 0.8, 6, '#7a7c82', { col: false })
  }
}

/* ------------------------------------------------------------------------ */
/* The classic eight                                                         */
/* ------------------------------------------------------------------------ */

function river(B, ctx, z, n) {
  const { T, k } = ctx
  const start = z
  stageGate(B, ctx, z, n, 'RUN! Jump from deck to deck')
  z = floor(B, ctx, z, 18, 0, T.grass, 'grass')
  const water = z
  // The very first stage: short, even hops a new player makes with one jump.
  for (const gap of [4, 5, 5, 6]) {
    z -= gap * k
    woodDeck(B, ctx, z, 11)
    z -= 11
  }
  z -= 4 * k
  // Open water on every side, right out to the horizon.
  surroundings(B, ctx, start - 18, z - 22, 'water', { banks: false })
  const s = z
  z = floor(B, ctx, z, 22, 0, T.grass, 'grass')
  endPads(B, ctx, s - 11, n)
  // Right behind the lobby wall the first stretch is lobby scenery (trees, boards).
  surroundings(B, ctx, n === 1 ? start - 12 : start, water, 'temple')
  surroundings(B, ctx, s, z, 'temple', { roofs: ['#c8483a', '#e08a2a'] })
  return z
}

/** A wooden jetty deck on posts: plank top, dark trim, rope rails and lanterns. */
function woodDeck(B, ctx, z, len) {
  const { ox } = ctx
  const w = 12
  const mid = z - len / 2
  B.slab(ox - w, ox + w, z, z - len, 0, 0.7, '#c98a4a', { tex: 'wood' })
  // Plank seams and dark edge beams.
  for (let x = -w + 3; x < w; x += 3) B.box(ox + x, 0.02, mid, 0.12, 0.06, len - 0.4, '#7a4a22', { col: false })
  for (const e of [z - 0.15, z - len + 0.15]) B.box(ox, -0.25, e, w * 2 + 0.3, 0.6, 0.35, '#6a3c1c', { col: false })
  for (const side of [-1, 1]) {
    B.box(ox + side * (w + 0.15), -0.25, mid, 0.35, 0.6, len, '#6a3c1c', { col: false })
    // Posts down into the water, topped by rope-rail stubs.
    for (const pz of [z - 0.8, mid, z - len + 0.8]) {
      B.box(ox + side * (w - 0.5), -2.2, pz, 0.7, 4, 0.7, '#5a3418', { col: false, shape: 'cyl' })
      B.box(ox + side * (w - 0.5), 0.9, pz, 0.35, 1.4, 0.35, '#8a5a2a', { col: false, shape: 'cyl' })
    }
    B.box(ox + side * (w - 0.5), 1.45, mid, 0.08, 0.08, len - 1.6, '#e8d8b0', { col: false })
    lantern(B, ox + side * (w - 2.2), mid, 0)
  }
}

function wallrun(B, ctx, z, n) {
  const { ox, T, k } = ctx
  const from = z
  stageGate(B, ctx, z, n, 'WALLRUN! Watch the falling walls')
  z = floor(B, ctx, z, 18, 0, T.ground, 'sand')
  // A first taste of the falling temple walls.
  z = gauntlet(B, ctx, z, 40, [
    { t: 'wall', dz: 16, side: -1 },
    { t: 'wall', dz: 32, side: 1 },
  ])
  B.label('<< WALL RUN', [ox - 8, 0.08, z + 5], { size: 1.6, color: '#ffffff', outline: '#222', flat: true })
  B.label('WALL RUN >>', [ox + 8, 0.08, z + 5], { size: 1.6, color: '#ffffff', outline: '#222', flat: true })
  const pit = 55 * k
  const wx = 12.5
  for (const side of [-1, 1]) {
    // Navy studded panels with neon edges, leaning out over the lava like the
    // original's. Tall enough to reach down into the pit.
    B.box(ox + side * wx, 4, z - pit / 2, 1, 22, pit, '#ffffff', {
      tex: 'wallrunPanel',
      rep: [pit / 14, 22 / 14],
      wallrun: true,
      r: [0, 0, side * -0.14],
      col: false,
    })
    // The lean is only for looks: the collider is a plain vertical wall, so running
    // on it behaves the same at any frame rate.
    B.box(ox + side * (wx - 0.3), 4, z - pit / 2, 1, 22, pit, '#000', { vis: false })
    for (let i = 0; i < Math.floor(pit / 18); i++) {
      B.label('Run On The Wall!', [ox + side * (wx - 1.3), 9, z - 9 - i * 18], {
        size: 0.8,
        color: '#ffffff',
        outline: '#10162a',
        rotY: (side * -Math.PI) / 2,
      })
    }
  }
  B.trigger('wallrun', [ox - HALF, -8, z - pit - 2], [ox + HALF, 30, z + 2])
  lavaPit(B, ctx, z, pit)
  z -= pit
  const s = z
  z = floor(B, ctx, z, 24, 0, T.ground, 'sand')
  endPads(B, ctx, s - 11, n)
  surroundings(B, ctx, from, z, 'land')
  return z
}

function tower(B, ctx, z, n) {
  const { ox, T, k } = ctx
  const from = z
  stageGate(B, ctx, z, n, 'TEMPLE RUN! Dodge the stones', '#ffb21f')
  z = floor(B, ctx, z, 18, 0, T.hallFloor, 'tiles')
  // Inside the great temple: crushers slam down, pillars crash across the hall.
  z = gauntlet(
    B,
    ctx,
    z,
    66,
    [
      { t: 'crush', dz: 12, x: -7 },
      { t: 'crush', dz: 12, x: 7, ph: 1.7 },
      { t: 'pillar', dz: 26, side: 1, lead: 14 },
      { t: 'crush', dz: 38, x: 0, w: 6, ph: 0.8 },
      { t: 'pillar', dz: 50, side: -1, lead: 14 },
      { t: 'crush', dz: 60, x: -8, ph: 2.2 },
      { t: 'crush', dz: 60, x: 8, ph: 0.4 },
    ],
    { color: '#e6d3a8', tex: 'tiles' },
  )
  doubleJumpHint(B, ox, 0, z + 3)
  for (const l of [
    { gap: 7, len: 8, top: 3.2 },
    { gap: 8, len: 8, top: 6.2 },
  ]) {
    pitBottom(B, ctx, z, l.gap * k)
    z -= l.gap * k
    B.slab(ox - HALF, ox + HALF, z, z - l.len, l.top, l.top + 14, T.hallFloor, { tex: 'tiles' })
    z -= l.len
  }
  pitBottom(B, ctx, z, 8 * k)
  z -= 8 * k
  const s = z
  z = floor(B, ctx, z, 24, 0, T.hallFloor, 'tiles')
  endPads(B, ctx, s - 11, n)
  templeHall(B, ctx, from - 2, z)
  surroundings(B, ctx, from, z, 'land')
  return z
}

function hall(B, ctx, z, n) {
  const { ox, k } = ctx
  const from = z
  stageGate(B, ctx, z, n, 'DOUBLE JUMP! Mind the crushers')
  z = floor(B, ctx, z, 18, 0, '#5a3a22', 'wood')
  z = gauntlet(
    B,
    ctx,
    z,
    44,
    [
      { t: 'crush', dz: 14, x: -6, ph: 0.2 },
      { t: 'crush', dz: 26, x: 6, ph: 1.1 },
      { t: 'crush', dz: 36, x: 0, ph: 2.0 },
    ],
    { color: '#5a3a22', tex: 'wood', warning: false },
  )
  doubleJumpHint(B, ox, 0, z + 3)
  for (const l of [
    { gap: 9, len: 12, top: 1.8 },
    { gap: 8, len: 10, top: 0.8 },
  ]) {
    pitBottom(B, ctx, z, l.gap * k)
    z -= l.gap * k
    B.slab(ox - HALF, ox + HALF, z, z - l.len, l.top, l.top + 14, '#5a3a22', { tex: 'wood' })
    z -= l.len
  }
  pitBottom(B, ctx, z, 8 * k)
  z -= 8 * k
  const s = z
  z = floor(B, ctx, z, 22, 0, '#5a3a22', 'wood')
  endPads(B, ctx, s - 11, n)
  for (const side of [-1, 1]) B.slab(ox + side * HALF, ox + side * (HALF + 2), from, z, 12, 12, '#d83a2e', { tex: 'hall' })
  for (let bz = from - 8; bz > z; bz -= 12) B.box(ox, 11.5, bz, HALF * 2 + 2, 1, 1.4, '#e8e2d6', { col: false })
  surroundings(B, ctx, from, z, 'land', { roofs: ['#8a4ac8', '#c8483a'] })
  return z
}

function dash(B, ctx, z, n) {
  const { ox, T, k } = ctx
  const from = z
  stageGate(B, ctx, z, n, 'DASH!')
  z = floor(B, ctx, z, 18, 0, T.ground, 'sand')
  B.label('DASH! (E)', [ox, 0.05, z + 5], { size: 3, color: '#ffe23a', outline: '#222', flat: true })
  B.W.crushers.push({ p: [ox - 5, 0, z + 11], s: [5, 3, 5], drop: 7, period: 3.4, ph: 0, kind: 'stone' })
  B.W.crushers.push({ p: [ox + 5, 0, z + 11], s: [5, 3, 5], drop: 7, period: 3.4, ph: 1.7, kind: 'stone' })
  // Jump + double jump + dash clears this even at the starting run speed.
  doubleJumpHint(B, ox, 0, z + 2)
  const gap = 20 * k
  lavaPit(B, ctx, z, gap)
  z -= gap
  const s = z
  z = floor(B, ctx, z, 24, 0, T.ground, 'sand')
  endPads(B, ctx, s - 11, n)
  surroundings(B, ctx, from, z, 'land')
  roundTower(B, ox - 42, z + 30, 16, 30)
  roundTower(B, ox + 44, z + 60, 14, 24)
  return z
}

function logs(B, ctx, z, n) {
  const { ox, T } = ctx
  const from = z
  stageGate(B, ctx, z, n, 'SPIN LOGS!')
  z = floor(B, ctx, z, 18, 0, T.grass, 'grass')
  z = gauntlet(
    B,
    ctx,
    z,
    34,
    [
      { t: 'tree', dz: 14, side: 1 },
      { t: 'tree', dz: 26, side: -1 },
    ],
    { color: T.grass, tex: 'grass' },
  )
  const bridgeStart = z
  const bridgeLen = 60
  B.slab(ox - 2.5, ox + 2.5, z, z - bridgeLen, 0, 0.8, T.wood, { tex: 'wood' })
  for (let i = 0; i < 3; i++) {
    B.W.spinners.push({ p: [ox, 0.55, z - 12 - i * 17], len: 9, speed: (i % 2 ? -1 : 1) * (1.8 + i * 0.35) })
    B.box(ox, 0.4, z - 12 - i * 17, 0.9, 0.8, 0.9, '#6b4423', { col: false })
  }
  z -= bridgeLen
  surroundings(B, ctx, bridgeStart, z, 'water', { pal: 'sakura' })
  surroundings(B, ctx, from, bridgeStart, 'forest')
  const s = z
  z = floor(B, ctx, z, 22, 0, T.grass, 'grass')
  endPads(B, ctx, s - 11, n)
  surroundings(B, ctx, s, z, 'forest', { pal: 'sakura' })
  return z
}

function zigzag(B, ctx, z, n) {
  const { ox, T, k } = ctx
  const from = z
  stageGate(B, ctx, z, n, 'ZIGZAG WALLRUN!')
  z = floor(B, ctx, z, 18, 0, T.ground, 'sand')
  const pit = 70 * k
  const seg = 23 * k
  for (const w of [
    { x: -6.5, z0: 2, z1: seg + 2 },
    { x: 6.5, z0: seg - 2, z1: 2 * seg + 2 },
    { x: -6.5, z0: 2 * seg - 2, z1: 3 * seg + 2 },
  ]) {
    const len = w.z1 - w.z0
    B.box(ox + w.x, 1, z - w.z0 - len / 2, 1, 22, len, '#ffffff', { tex: 'wallrunPanel', rep: [len / 14, 22 / 14], wallrun: true })
  }
  B.trigger('wallrun', [ox - HALF, -8, z - pit - 2], [ox + HALF, 30, z + 2])
  lavaPit(B, ctx, z, pit)
  z -= pit
  const s = z
  z = floor(B, ctx, z, 24, 0, T.ground, 'sand')
  endPads(B, ctx, s - 11, n)
  surroundings(B, ctx, from, z, 'land')
  return z
}

function hokage(B, ctx, z, n) {
  const { ox, T, k } = ctx
  const from = z
  stageGate(B, ctx, z, n, 'FINAL: HOKAGE ROCK!', '#ffc21f')
  z = floor(B, ctx, z, 18, 0, T.grass, 'grass')
  z = gauntlet(
    B,
    ctx,
    z,
    52,
    [
      { t: 'wall', dz: 14, side: 1 },
      { t: 'crush', dz: 24, x: -6, ph: 0.6 },
      { t: 'wall', dz: 34, side: -1 },
      { t: 'crush', dz: 44, x: 6, ph: 2 },
    ],
    { color: T.grass, tex: 'grass' },
  )
  doubleJumpHint(B, ox, 0, z + 3)
  for (const c of [
    { gap: 10, top: 2 },
    { gap: 12, top: 4 },
    { gap: 13, top: 6 },
    { gap: 14, top: 8 },
  ]) {
    pitBottom(B, ctx, z, c.gap * k)
    z -= c.gap * k
    B.slab(ox - 7, ox + 7, z, z - 8, c.top, c.top + 14, T.stone, { tex: 'stone' })
    z -= 8
  }
  pitBottom(B, ctx, z, 10 * k)
  z -= 10 * k
  const s = z
  B.slab(ox - HALF, ox + HALF, z, z - 30, 8, 22, T.grass, { tex: 'grass' })
  z -= 30
  endPads(B, ctx, s - 14, n, 8)
  // The rock face with four carved Hokage heads.
  B.box(ox, 20, z - 4, 60, 40, 8, '#b98a5a', { tex: 'stone' })
  for (let i = 0; i < 4; i++) {
    const hx = ox - 16.5 + i * 11
    B.box(hx, 16, z + 0.6, 8, 9, 2, '#c99a68', { col: false })
    B.box(hx - 1.8, 17.3, z + 1.7, 1.4, 0.8, 0.3, '#3a2a1a', { col: false })
    B.box(hx + 1.8, 17.3, z + 1.7, 1.4, 0.8, 0.3, '#3a2a1a', { col: false })
    B.box(hx, 14, z + 1.7, 2.6, 0.5, 0.3, '#5a3a22', { col: false })
  }
  B.label('CONGRATULATIONS, HOKAGE!', [ox, 30, z + 1], { size: 2.6, color: '#ffc21f', outline: '#5a2a00' })
  surroundings(B, ctx, from, z, 'temple', { roofs: ['#c8483a', '#e08a2a', '#3a9a4a'] })
  return z - 8
}

/* ------------------------------------------------------------------------ */
/* Shinobi technique stages (World 1, 8-19)                                  */
/* ------------------------------------------------------------------------ */

/** Kakashi's chakra control: stand on water, but only while you keep moving. */
/**
 * Stepping stones over deadly water. The stones sit low enough to hop between, and
 * one in every row sinks away for a moment now and then: stand on it and you swim.
 */
function waterwalk(B, ctx, z, n) {
  const { ox, T } = ctx
  const from = z
  stageGate(B, ctx, z, n, 'STEPPING STONES! Some of them sink...', '#2fa8ff')
  z = floor(B, ctx, z, 18, 0, T.grass, 'grass')
  const lakeStart = z
  const lake = 60
  surroundings(B, ctx, z, z - lake, 'water')
  for (let row = 0; row < 8; row++) {
    const dz = 5 + row * 7
    const shift = row % 2 ? 2 : -2
    for (const [i, x] of [shift - 4.5, shift + 4.5].entries()) {
      const sinks = i === row % 2
      B.W.blinkers.push({
        kind: 'stone',
        p: [ox + x, -0.5, z - dz],
        s: [4.2, 1, 4.2],
        // Always there, or gone for 1.8 s in every 6 - never both stones of a row.
        period: sinks ? 6 : 1e9,
        off: sinks ? 1.8 : 0.001,
        ph: row * 1.3,
      })
    }
  }
  // Lily pads to read the surface.
  for (let i = 0; i < 14; i++) {
    const x = ((i * 37) % 33) - 16
    const zz = z - 4 - ((i * 29) % (lake - 8))
    B.box(ox + x, -1.35, zz, 1.6 + (i % 3) * 0.5, 0.06, 1.6 + (i % 3) * 0.5, '#3fae3a', { col: false, shape: 'cyl' })
  }
  z -= lake
  const s = z
  z = floor(B, ctx, z, 22, 0, T.grass, 'grass')
  endPads(B, ctx, s - 11, n)
  surroundings(B, ctx, from, lakeStart, 'forest')
  surroundings(B, ctx, s, z, 'forest')
  return z
}

/** Rock Lee: green launch pads fling you up the cliffs. */
function hurricane(B, ctx, z, n) {
  const { ox, T } = ctx
  const from = z
  stageGate(B, ctx, z, n, 'LEAF HURRICANE! Launch, dodge, ride the leaves', '#39e34a')
  z = floor(B, ctx, z, 22, 0, T.grass, 'grass')
  z = gauntlet(
    B,
    ctx,
    z,
    30,
    [
      { t: 'tree', dz: 12, side: -1 },
      { t: 'tree', dz: 22, side: 1 },
    ],
    { color: T.grass, tex: 'grass' },
  )
  // Training posts along the start.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      B.box(ox + side * 10, 1.3, z + 18 - i * 6, 0.7, 2.6, 0.7, '#9b6a3a', { tex: 'wood' })
      B.box(ox + side * 10, 1.6, z + 18 - i * 6, 0.8, 0.5, 0.8, '#e8e2d6', { col: false })
    }
  }
  launchPad(B, ctx, 0, 0, z + 4)
  for (const [i, c] of [
    { gap: 18, top: 6, len: 16 },
    { gap: 18, top: 10, len: 16 },
  ].entries()) {
    pitBottom(B, ctx, z, c.gap)
    z -= c.gap
    pillar(B, ctx, 0, z - c.len / 2, 18, c.len, c.top)
    // A spinning log sweeps each cliff top: jump it, then hit the next pad.
    B.W.spinners.push({ p: [ox, c.top + 0.55, z - 6], len: 14, speed: i % 2 ? -1.6 : 1.4 })
    // From the second cliff you drop onto the rafts instead.
    if (i === 0) launchPad(B, ctx, 0, c.top, z - c.len + 3)
    z -= c.len
  }
  // Leaf rafts drifting side to side carry you down to the finish.
  const c = z
  const rafts = [
    { dz: 8, top: 7, a: [6, 0, 0], w: 1.1, ph: 0 },
    { dz: 19, top: 4.5, a: [-6, 0, 0], w: 1.2, ph: 1.2 },
    { dz: 30, top: 2, a: [6, 0, 0], w: 1.3, ph: 2.1 },
  ]
  for (const r of rafts) {
    B.W.movers.push({ p: [ox, r.top, c - r.dz], s: [7, 0.8, 7], a: r.a, w: r.w, ph: r.ph, color: '#57c84a' })
  }
  pitBottom(B, ctx, c, 38)
  z = c - 38
  const s = z
  z = floor(B, ctx, z, 26, 0, T.grass, 'grass')
  endPads(B, ctx, s - 12, n)
  surroundings(B, ctx, from, z, 'forest', { pal: 'autumn' })
  return z
}

/** Minato: grab a Flying Raijin kunai and you leap in a golden arc to the next island. */
function raijin(B, ctx, z, n) {
  const { ox, T } = ctx
  const from = z
  stageGate(B, ctx, z, n, 'FLYING RAIJIN! Touch the kunai', '#ffd21f')
  z = floor(B, ctx, z, 18, 0, T.grass, 'grass')
  const c = z
  // Floating islands across a bottomless gorge.
  const islands = [
    { dz: 45, top: 4, w: 12 },
    { dz: 95, top: 8, w: 12 },
    { dz: 140, top: 5, w: 12 },
  ]
  for (const is of islands) pillar(B, ctx, 0, c - is.dz, is.w, is.w, is.top, '#8e8a80')
  // Island one: a spinning log guards the kunai. Island two: a shuriken sweeps the
  // pillar. Island three: rafts of rock drift past the low wall.
  B.W.spinners.push({ p: [ox, islands[0].top + 0.55, c - islands[0].dz], len: 8, speed: 1.5 })
  B.W.hazards.push({ kind: 'shuriken', p: [ox, islands[1].top + 1.3, c - islands[1].dz + 1.5], a: [3.5, 0, 0], w: 1.6, ph: 0, r: 1.3 })
  B.W.spinners.push({ p: [ox, islands[2].top + 0.55, c - islands[2].dz + 2.5], len: 9, speed: -1.3 })
  pitBottom(B, ctx, c, 160)
  const land = c - 160
  const at = (i) => [ox, islands[i].top + 1.2, c - islands[i].dz + islands[i].w / 2 - 1.5]
  const kunai = (x, y, zz, to) => {
    B.W.props.push({ kind: 'kunai', p: [ox + x, y, zz] })
    warp(B, ox + x, y, zz, to, false, true)
  }
  kunai(0, 0, c + 3, at(0))
  kunai(0, islands[0].top, c - islands[0].dz - 3, at(1))
  // On island two the kunai sits on a pillar: double jump to reach it.
  B.box(ox, islands[1].top + 1.75, c - islands[1].dz - 2.5, 2.5, 3.5, 2.5, '#6f6c66', { tex: 'stone' })
  doubleJumpHint(B, ox, islands[1].top + 2.4, c - islands[1].dz - 1)
  kunai(0, islands[1].top + 3.5, c - islands[1].dz - 2.5, at(2))
  // On island three it hides behind a low wall.
  B.box(ox, islands[2].top + 1, c - islands[2].dz + 0.5, 10, 2, 0.8, '#6f6c66', { tex: 'stone' })
  kunai(3, islands[2].top, c - islands[2].dz - 3, [ox, 1.2, land - 4])
  z = land
  const s = z
  z = floor(B, ctx, z, 24, 0, T.grass, 'grass')
  endPads(B, ctx, s - 11, n)
  surroundings(B, ctx, from, c, 'forest')
  surroundings(B, ctx, c, s, 'canyon', { height: 26, color: '#8e8a80' })
  surroundings(B, ctx, s, z, 'forest')
  return z
}

/**
 * A river with wooden boats drifting across it: hop from boat to boat. Some boats
 * sink for a moment now and then (they rock hard first); the water is deadly.
 */
function toads(B, ctx, z, n) {
  const { ox, T } = ctx
  const from = z
  stageGate(B, ctx, z, n, 'RIVER BOATS! Jump before they sink', '#ff7a1a')
  z = floor(B, ctx, z, 18, 0, T.grass, 'grass')
  const river = z
  const boats = [
    { dz: 7, a: -6, w: 0.9, ph: 0 },
    { dz: 16, a: 7, w: 0.75, ph: 1.4, sink: { period: 7, ph: 0, down: 1.6, depth: 3 } },
    { dz: 25, a: -7, w: 0.85, ph: 2.6 },
    { dz: 34, a: 6, w: 0.8, ph: 0.6, sink: { period: 8, ph: 3, down: 1.6, depth: 3 } },
    { dz: 43, a: -7, w: 0.95, ph: 2 },
    { dz: 52, a: 7, w: 0.8, ph: 1, sink: { period: 7.5, ph: 5, down: 1.6, depth: 3 } },
    { dz: 61, a: -5, w: 0.7, ph: 0.3 },
  ]
  for (const b of boats) {
    B.W.movers.push({
      kind: 'boat',
      p: [ox, -0.9, river - b.dz],
      s: [5.2, 0.7, 3.6],
      a: [b.a, 0, 0],
      w: b.w,
      ph: b.ph,
      sink: b.sink,
    })
  }
  z = river - 68
  surroundings(B, ctx, river, z, 'water')
  // River banks: reeds and rocks along both sides.
  for (let i = 0; i < 10; i++) {
    const zz = river - 4 - i * 6.5
    B.box(ox + (i % 2 ? 18 : -18), -0.6, zz, 2.2, 1.6, 2.2, '#7d7a70', { tex: 'stone', col: false })
  }
  const s = z
  z = floor(B, ctx, z, 24, 0, T.grass, 'grass')
  endPads(B, ctx, s - 11, n)
  surroundings(B, ctx, from, river, 'forest')
  surroundings(B, ctx, s, z, 'forest')
  return z
}

/** Gaara: rafts of sand drift over the canyon. */
function sand(B, ctx, z, n) {
  const { ox } = ctx
  const from = z
  stageGate(B, ctx, z, n, 'SAND COFFIN! Ride the moving sand', '#e0b25e')
  z = floor(B, ctx, z, 18, 0, '#e2bd7e', 'sand')
  z = gauntlet(
    B,
    ctx,
    z,
    32,
    [
      { t: 'crush', dz: 10, x: -6, ph: 0 },
      { t: 'crush', dz: 10, x: 6, ph: 1.7 },
      { t: 'crush', dz: 22, x: 0, w: 7, ph: 0.9 },
    ],
    { color: '#e2bd7e', tex: 'sand', crushKind: 'sand' },
  )
  const c = z
  const rafts = [
    { dz: 10, a: [7, 0, 0], w: 1.2, ph: 0 },
    { dz: 22, a: [-7, 0, 0], w: 1.2, ph: 0.9 },
    { dz: 34, a: [0, 3, 0], w: 1.1, ph: 0 },
    { dz: 47, a: [7, 0, 0], w: 1.5, ph: 2 },
    { dz: 66, a: [0, 0, 9], w: 0.9, ph: 0 },
  ]
  for (const r of rafts) {
    B.W.movers.push({ p: [ox, 0, c - r.dz], s: [6, 1, 6], a: r.a, w: r.w, ph: r.ph, color: '#e8c07a' })
  }
  pitBottom(B, ctx, c, 88)
  z = c - 88
  const s = z
  z = floor(B, ctx, z, 24, 0, '#e2bd7e', 'sand')
  endPads(B, ctx, s - 11, n)
  // Gaara's giant gourd watching from the finish.
  B.W.props.push({ kind: 'gourd', p: [ox + 9, 0, s - 20] })
  surroundings(B, ctx, from, z, 'canyon', { height: 18, color: '#d9a86a' })
  return z
}

/** Itachi: two sets of platforms take turns being real. */
function genjutsu(B, ctx, z, n) {
  const { ox } = ctx
  const from = z
  stageGate(B, ctx, z, n, 'GENJUTSU! Only real platforms hold you', '#ff2a3a')
  z = floor(B, ctx, z, 18, 0, '#4a2a2e', 'stone')
  const c = z
  for (let i = 0; i < 9; i++) {
    B.W.blinkers.push({
      p: [ox + (i % 2 ? 4 : -4), 0.3 * (i % 3), c - 8 - i * 9],
      s: [6, 0.8, 6],
      group: i % 2,
      period: 2.8,
    })
  }
  const len = 8 + 9 * 9
  pitBottom(B, ctx, c, len)
  B.W.props.push({ kind: 'moon', p: [ox, 45, c - 130] })
  B.W.props.push({ kind: 'crows', p: [ox, 14, c - 40] })
  z = c - len
  const s = z
  z = floor(B, ctx, z, 24, 0, '#4a2a2e', 'stone')
  endPads(B, ctx, s - 11, n)
  B.W.props.push({ kind: 'shinobi', id: 'kage', p: [ox - 9, 0, s - 18], yaw: 0.4, scale: 1.6 })
  surroundings(B, ctx, from, z, 'canyon', { height: 16, color: '#4a3a3e' })
  return z
}

/** Sasuke: dash into the rock walls to smash through with Chidori. */
function chidori(B, ctx, z, n) {
  const { ox } = ctx
  const from = z
  stageGate(B, ctx, z, n, 'CHIDORI! Dash (E) through the walls', '#5fc8ff')
  z = floor(B, ctx, z, 18, 0, '#9a948c', 'stone')
  B.label('DASH (E) INTO THE WALLS!', [ox, 0.08, z + 7], { size: 1.6, color: '#9fdcff', outline: '#10243a', flat: true })
  const c = z
  z = floor(B, ctx, z, 80, 0, '#9a948c', 'stone')
  B.W.crushers.push({ p: [ox - 6, 0, c - 41], s: [5, 3, 5], drop: 7, period: 3, ph: 0, kind: 'stone' })
  B.W.crushers.push({ p: [ox + 6, 0, c - 41], s: [5, 3, 5], drop: 7, period: 3, ph: 1.5, kind: 'stone' })
  for (const dz of [14, 32, 50, 66]) {
    const id = B.W.breakables.length
    B.W.breakables.push({ id, p: [ox, 4, c - dz], s: [HALF * 2, 8, 2] })
    B.trigger('breakwall', [ox - HALF, -1, c - dz + 0.9], [ox + HALF, 6, c - dz + 7], { id })
  }
  const s = z
  z = floor(B, ctx, z, 22, 0, '#9a948c', 'stone')
  endPads(B, ctx, s - 11, n)
  B.W.props.push({ kind: 'shinobi', id: 'mira', p: [ox + 9, 0, s - 17], yaw: -0.4, scale: 1.6 })
  surroundings(B, ctx, from, z, 'canyon', { height: 20, color: '#8f8a84' })
  return z
}

/** Tenten: giant spinning shuriken sweep across a narrow bridge. */
function shuriken(B, ctx, z, n) {
  const { ox, T } = ctx
  const from = z
  stageGate(B, ctx, z, n, 'SHURIKEN STORM! Dodge the blades', '#c9ced6')
  z = floor(B, ctx, z, 18, 0, T.grass, 'grass')
  const c = z
  const len = 66
  B.slab(ox - 3.5, ox + 3.5, c, c - len, 0, 0.8, T.wood, { tex: 'wood' })
  ;[12, 24, 36, 48, 58].forEach((dz, i) => {
    B.W.hazards.push({
      kind: 'shuriken',
      p: [ox, 1.3, c - dz],
      a: [7.5, 0, 0],
      w: 1.2 + (i % 3) * 0.25,
      ph: i * 1.3,
      r: 1.5,
    })
  })
  // Training targets along the banks.
  for (let i = 0; i < 4; i++) B.W.props.push({ kind: 'target', p: [ox + (i % 2 ? 16 : -16), 0, c - 10 - i * 16] })
  z = c - len
  surroundings(B, ctx, c, z, 'water')
  const s = z
  z = floor(B, ctx, z, 22, 0, T.grass, 'grass')
  endPads(B, ctx, s - 11, n)
  surroundings(B, ctx, from, c, 'forest')
  surroundings(B, ctx, s, z, 'forest')
  return z
}

/** Pain: every few seconds a blast throws you back unless rubble shields you. */
function shinra(B, ctx, z, n) {
  const { ox } = ctx
  const from = z
  stageGate(B, ctx, z, n, 'SHINRA TENSEI! Hide behind the rubble', '#b98cff')
  z = floor(B, ctx, z, 18, 0, '#8a6a4a', 'sand')
  const c = z
  // A cratered path with two gaps.
  let zz = c
  for (const [len, gap] of [
    [22, 5],
    [20, 5],
    [18, 0],
  ]) {
    zz = floor(B, ctx, zz, len, 0, '#8a6a4a', 'sand')
    if (gap) {
      pitBottom(B, ctx, zz, gap)
      zz -= gap
    }
  }
  // Rubble walls to hide behind, alternating sides.
  ;[
    [-3.5, 8],
    [3.5, 19],
    [-3.5, 33],
    [3.5, 45],
    [-3.5, 58],
  ].forEach(([x, dz], i) => {
    B.box(ox + x, 1.75, c - dz, 9, 3.5, 1.6, i % 2 ? '#7a7066' : '#8a7e70', { tex: 'stone' })
  })
  const craterEnd = zz
  const s = zz
  z = floor(B, ctx, zz, 30, 0, '#8a6a4a', 'sand')
  const origin = [ox, 6, s - 22]
  B.trigger('shinra', [ox - HALF - 0.5, -5, craterEnd], [ox + HALF + 0.5, 12, c - 4], { origin, period: 4, force: 16, id: n })
  B.W.pulses.push({ origin, period: 4 })
  B.W.props.push({ kind: 'shinobi', id: 'nova', p: [origin[0], origin[1] - 2.4, origin[2]], yaw: 0, scale: 2.2, float: true })
  endPads(B, ctx, s - 11, n)
  surroundings(B, ctx, from, z, 'canyon', { height: 8, color: '#7a5a3a' })
  return z
}

/** Obito: three portals per row, only the one under the Sharingan is real. */
function kamui(B, ctx, z, n) {
  const { ox } = ctx
  stageGate(B, ctx, z, n, 'KAMUI! Follow the Sharingan', '#8a3aff')
  const spawn = [ox, 1.2, z - 12]
  z = floor(B, ctx, z, 20, 0, '#2a2340', 'tiles')
  const c = z
  const rows = [
    { z: c + 3, real: 2, top: 0 },
    { z: c - 40, real: 0, top: 0 },
    { z: c - 80, real: 1, top: 0 },
  ]
  // Floating platforms in the Kamui dimension.
  for (const zc of [c - 32, c - 72]) {
    B.slab(ox - HALF, ox + HALF, zc, zc - 12, 0, 3, '#2a2340', { tex: 'tiles' })
  }
  const landing = c - 110
  rows.forEach((row, r) => {
    const dest = r < rows.length - 1 ? [ox, 1.2, [c - 34, c - 74][r]] : [ox, 1.2, landing - 4]
    ;[-7, 0, 7].forEach((x, i) => {
      const real = i === row.real
      B.W.props.push({ kind: 'portal', p: [ox + x, row.top, row.z], real })
      warp(B, ox + x, row.top, row.z, real ? dest : spawn, !real)
    })
  })
  pitBottom(B, ctx, c, 110)
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1
    B.box(ox + side * (18 + ((i * 7) % 20)), -4 + ((i * 11) % 26), c - ((i * 23) % 110), 4 + (i % 3) * 2, 4 + (i % 3) * 2, 4 + (i % 3) * 2, '#3a2a5a', {
      col: false,
      tex: 'tiles',
    })
  }
  z = landing
  const s = z
  z = floor(B, ctx, z, 24, 0, '#2a2340', 'tiles')
  endPads(B, ctx, s - 11, n)
  B.W.props.push({ kind: 'shinobi', id: 'tengu', p: [ox - 9, 0, s - 18], yaw: 0.4, scale: 1.6 })
  return z
}

/** Madara: meteors rain on the battlefield. Watch the red circles. */
function meteor(B, ctx, z, n) {
  const { ox } = ctx
  const from = z
  stageGate(B, ctx, z, n, 'TENGAI SHINSEI! Dodge the meteors', '#ff5a1f')
  z = floor(B, ctx, z, 18, 0, '#7a6a5a', 'stone')
  const c = z
  z = floor(B, ctx, z, 82, 0, '#7a6a5a', 'stone')
  const xs = [-7, -2, 4, 8, -5, 1, 6, -8, 0, 5]
  xs.forEach((x, i) => {
    B.W.hazards.push({ kind: 'meteor', p: [ox + x, 0, c - 8 - i * 7.5], period: 3.4 + (i % 3) * 0.45, ph: i * 0.83, r: 2.4 })
  })
  // Madara watches from a rock pillar.
  B.box(ox + 20, 5, c - 60, 6, 10, 6, '#6a5a4a', { tex: 'stone', col: false })
  B.W.props.push({ kind: 'shinobi', id: 'oro', p: [ox + 20, 10, c - 60], yaw: -Math.PI / 2, scale: 2.4 })
  const s = z
  z = floor(B, ctx, z, 22, 0, '#7a6a5a', 'stone')
  endPads(B, ctx, s - 11, n)
  surroundings(B, ctx, from, z, 'canyon', { height: 10, color: '#6a5040' })
  return z
}

/** The Valley of the End: cross the river and climb beside the waterfall. */
function valley(B, ctx, z, n) {
  const { ox, T } = ctx
  const from = z
  stageGate(B, ctx, z, n, 'VALLEY OF THE END! Climb the waterfall', '#39b8ff')
  z = floor(B, ctx, z, 18, 0, '#8d8f95', 'stone')
  const c = z
  // Stepping stones across the river.
  ;[
    [-3, 9],
    [4, 19],
    [-4, 29],
    [3, 39],
    [-1, 49],
  ].forEach(([x, dz], i) => pillar(B, ctx, x, c - dz, 4, 4, 0.6 + (i % 2) * 0.5, '#7d7f86', '#9aa39a'))
  // Ledges up the cliff, zig-zagging.
  doubleJumpHint(B, ox, 1.1, c - 53)
  ;[
    [-5, 60, 3],
    [4, 69, 6],
    [-3, 78, 9],
    [3, 87, 12],
  ].forEach(([x, dz, top]) => pillar(B, ctx, x, c - dz, 8, 4, top, '#7d7f86', '#9aa39a'))
  const plateau = c - 92
  B.slab(ox - HALF, ox + HALF, plateau, plateau - 26, 12, 26, '#7d7f86', { tex: 'stone' })
  B.slab(ox - HALF, ox + HALF, plateau - 0.1, plateau - 26, 12.06, 0.12, T.grass, { tex: 'grass', col: false })
  endPads(B, ctx, plateau - 13, n, 12)
  B.W.props.push({ kind: 'waterfall', p: [ox, 5.3, plateau + 0.35], w: 28, h: 13.4 })
  surroundings(B, ctx, c, plateau, 'water')
  // The two giant statues facing each other across the river.
  B.W.props.push({ kind: 'statue', id: 'oro', p: [ox - 24, -1, c - 52], yaw: Math.PI / 2, scale: 13 })
  B.W.props.push({ kind: 'statue', id: 'hashirama', p: [ox + 24, -1, c - 52], yaw: -Math.PI / 2, scale: 13 })
  for (const side of [-1, 1]) {
    B.slab(ox + side * 36, ox + side * 70, c, plateau - 26, 32, 34, '#7d8a6a', { tex: 'stone', col: false })
  }
  // Drop off the plateau to reach the next gate.
  z = plateau - 26
  z = floor(B, ctx, z, 10, 0, T.grass, 'grass')
  surroundings(B, ctx, from, c, 'forest')
  surroundings(B, ctx, plateau - 26, z, 'forest')
  return z
}

const BUILDERS = {
  river,
  wallrun,
  tower,
  hall,
  dash,
  logs,
  zigzag,
  waterwalk,
  hurricane,
  raijin,
  toads,
  sand,
  genjutsu,
  chidori,
  shuriken,
  shinra,
  kamui,
  meteor,
  valley,
  hokage,
}

/**
 * Builds every stage of a world from `courseStart`, tagging each stage's data with
 * its chunk so the renderer can hide stages far from the player.
 */
export function buildStages(B, ctx, courseStart) {
  const { ox, world } = ctx
  let z = courseStart
  WORLD_STAGES[world].forEach((key, i) => {
    B.beginChunk(`${world}-${i + 1}`)
    ctx.n = i + 1
    z = BUILDERS[key](B, ctx, z, i + 1)
  })
  B.beginChunk(`${world}-end`)
  // Invisible side boundaries so the course can't be skipped around the edges.
  const len = Math.abs(z - courseStart)
  for (const side of [-1, 1]) B.box(ox + side * (HALF + 0.5), 20, courseStart - len / 2, 1, 60, len, '#000', { vis: false })
  B.box(ox, 20, z - 1, HALF * 2 + 2, 60, 1, '#000', { vis: false })
  tree(B, ox, z - 12, 1.4)
}
