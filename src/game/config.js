/**
 * All tunable game data for +1 Speed Shinobi Escape, in one place.
 *
 * Numbers mirror the original Roblox game where the screenshots show them
 * (character bonuses and win requirements, treadmill multipliers, level curve,
 * prices); everything else is tuned to feel the same.
 */

/**
 * Characters. They never change how fast you run (that comes from your level);
 * each one has its own running and jumping effects instead — `fx` picks the style
 * and later characters get bigger, brighter versions.
 * `wins` = wins required to equip; `product` = bought with wins in the shop.
 */
export const CHARACTERS = [
  { id: 'kaito', name: 'KAITO', color: '#2fd6c8', fx: 'spark', wins: 0 },
  { id: 'hana', name: 'HANA', color: '#c89aff', fx: 'petal', wins: 5 },
  { id: 'ryu', name: 'RYU', color: '#ff5a2a', fx: 'flame', wins: 15 },
  { id: 'mira', name: 'MIRA', color: '#39b8ff', fx: 'bolt', wins: 30 },
  { id: 'takeshi', name: 'TAKESHI', color: '#4fd14a', fx: 'leaf', wins: 60 },
  { id: 'suna', name: 'SUNA', color: '#e0b060', fx: 'sand', wins: 100 },
  { id: 'yuki', name: 'YUKI', color: '#9fe6ff', fx: 'spark', wins: 150 },
  { id: 'kage', name: 'KAGE', color: '#8a4dff', fx: 'feather', wins: 350 },
  { id: 'akane', name: 'AKANE', color: '#ff3040', fx: 'flame', wins: 750 },
  { id: 'zephyr', name: 'ZEPHYR', color: '#b8ff3a', fx: 'leaf', wins: 3000 },
  { id: 'nova', name: 'NOVA', color: '#b06bff', fx: 'aura', wins: 10000 },
  { id: 'oro', name: 'ORO', color: '#ffc21f', fx: 'aura', wins: 20000 },
  { id: 'kitsune', name: 'KITSUNE', color: '#ff7a3a', fx: 'flame', product: 'char_kitsune' },
  { id: 'tengu', name: 'TENGU', color: '#e8283a', fx: 'feather', product: 'char_tengu' },
  { id: 'dragon', name: 'JADE DRAGON', color: '#2fe08a', fx: 'aura', product: 'char_dragon' },
  { id: 'spirit', name: 'SPIRIT QUEEN', color: '#e0a0ff', fx: 'aura', product: 'char_spirit' },
]
export const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]))

/**
 * `equipped` value for "my own Bloxity avatar". Every new player starts with it and
 * can switch back to it at any time; it gets a neutral blue effect colour.
 */
export const BLOXITY_AVATAR = 'bloxity'
export const BLOXITY_LOOK = { id: BLOXITY_AVATAR, name: 'MY AVATAR', color: '#5fd0ff', fx: 'spark' }

/** Look (colour + effect style) of whatever the player has equipped. */
export function lookFor(id) {
  return CHARACTER_BY_ID[id] || BLOXITY_LOOK
}

/** Effect label shown on each pedestal. */
export const FX_NAMES = {
  spark: 'Chakra Sparks',
  petal: 'Blossom Petals',
  bolt: 'Lightning',
  leaf: 'Leaf Whirl',
  sand: 'Sand Storm',
  flame: 'Fire Aura',
  feather: 'Crow Feathers',
  aura: 'Power Aura',
}

/** Effect strength 0..1: later characters get bigger effects. */
export function fxPower(id) {
  const i = CHARACTERS.findIndex((c) => c.id === id)
  return Math.max(0, i) / (CHARACTERS.length - 1)
}

/**
 * Auras for your own Bloxity avatar, bought with wins: a glow rising off the body,
 * motes drifting up around it and glowing footprints that linger for a few seconds.
 * Every character already comes with an aura of its own (its colour and effect).
 */
export const AURAS = [
  { id: 'none', name: 'No Aura', cost: 0 },
  { id: 'chakra', name: 'Chakra Glow', cost: 50, color: '#4fd8ff', fx: 'spark' },
  { id: 'sakura', name: 'Sakura Drift', cost: 150, color: '#ff8ad8', fx: 'petal' },
  { id: 'ember', name: 'Ember Flame', cost: 400, color: '#ff6a1a', fx: 'flame' },
  { id: 'storm', name: 'Storm Surge', cost: 1000, color: '#8fd0ff', fx: 'bolt' },
  { id: 'jade', name: 'Jade Wind', cost: 2500, color: '#3fe06a', fx: 'leaf' },
  { id: 'shadow', name: 'Shadow Veil', cost: 6000, color: '#9a5bff', fx: 'feather' },
  { id: 'golden', name: 'Golden Sage', cost: 15000, color: '#ffc21f', fx: 'aura' },
]
export const AURA_BY_ID = Object.fromEntries(AURAS.map((a) => [a.id, a]))

/**
 * The aura someone shows, or null: a character's own, or the one bought for the
 * Bloxity avatar. `power` 0..1 scales how big and bright it is.
 */
export function auraFor(equipped, auraId) {
  const c = CHARACTER_BY_ID[equipped]
  if (c) return { id: c.id, color: c.color, fx: c.fx, power: 0.35 + fxPower(c.id) * 0.65 }
  const a = AURA_BY_ID[auraId]
  if (!a || a.id === 'none') return null
  return { id: a.id, color: a.color, fx: a.fx, power: 0.3 + (AURAS.indexOf(a) / (AURAS.length - 1)) * 0.7 }
}

/**
 * Everything in the shop is bought with wins.
 * `pass` = owned forever, `consumable` = can be bought again.
 */
export const PRODUCTS = {
  x2speed: { name: 'x2 Speed', price: 150, kind: 'pass' },
  x2wins: { name: 'Wins x2 Forever', price: 400, kind: 'pass' },
  tread5: { name: 'x5 Treadmill', price: 300, kind: 'pass' },
  tread10: { name: 'x10 Treadmill', price: 1000, kind: 'pass' },
  tread25: { name: 'x25 Treadmill', price: 4000, kind: 'pass' },
  rainbowtrail: { name: 'Rainbow Trail', price: 5000, kind: 'pass' },
  char_kitsune: { name: 'Kitsune', price: 800, kind: 'pass' },
  char_tengu: { name: 'Tengu', price: 1500, kind: 'pass' },
  char_dragon: { name: 'Jade Dragon', price: 25000, kind: 'pass' },
  char_spirit: { name: 'Spirit Queen', price: 25000, kind: 'pass' },
  speed250: { name: '+250 Speed', price: 10, kind: 'consumable', grant: { speed: 250 } },
  speed1k: { name: '+1k Speed', price: 35, kind: 'consumable', grant: { speed: 1000 } },
  speed5k: { name: '+5k Speed', price: 150, kind: 'consumable', grant: { speed: 5000 } },
  speed20k: { name: '+20k Speed', price: 500, kind: 'consumable', grant: { speed: 20000 } },
}

/** Treadmills. Standing on one counts as running, times its multiplier. */
export const TREADMILLS = [
  { id: 'x1.5', mult: 1.5, label: 'x1.5 Speed', sub: '1 Rebirth', rebirths: 1, color: '#35d04a' },
  { id: 'x2', mult: 2, label: 'x2 Speed', sub: '3 Rebirths', rebirths: 3, color: '#27d3ff' },
  { id: 'x4', mult: 4, label: 'x4 Speed', sub: '20 Rebirths', rebirths: 20, color: '#ff3040' },
  { id: 'train1', mult: 1, label: 'TRAIN HERE', sub: '', rebirths: 0, color: '#c9ccd1' },
  { id: 'train2', mult: 1, label: 'TRAIN HERE', sub: '', rebirths: 0, color: '#c9ccd1' },
  { id: 'x5', mult: 5, label: 'x5 Speed', sub: '', product: 'tread5', color: '#b43cff' },
  { id: 'x10', mult: 10, label: 'x10 Speed', sub: '', product: 'tread10', color: '#ff6a1a' },
  { id: 'x25', mult: 25, label: 'x25 Speed', sub: '', product: 'tread25', color: '#6fe3ff' },
]

/** Trails, bought with wins (the rainbow one with Bux). Boost speed gain. */
export const TRAILS = [
  { id: 'none', name: 'No Trail', cost: 0, boost: 0, color: '#ffffff' },
  { id: 'blue', name: 'Chakra Blue', cost: 25, boost: 0.1, color: '#2fa8ff' },
  { id: 'leaf', name: 'Leaf Green', cost: 75, boost: 0.25, color: '#39e34a' },
  { id: 'fire', name: 'Fire Style', cost: 200, boost: 0.5, color: '#ff5a1a' },
  { id: 'susanoo', name: 'Violet Storm', cost: 600, boost: 1, color: '#a24bff' },
  { id: 'kurama', name: 'Golden Blaze', cost: 2000, boost: 2, color: '#ffc21f' },
  { id: 'rainbow', name: 'Rainbow', product: 'rainbowtrail', boost: 3, color: 'rainbow' },
]
export const TRAIL_BY_ID = Object.fromEntries(TRAILS.map((t) => [t.id, t]))

/** Wins given by the yellow "Restart!" pad at the end of each stage, per world. */
export const STAGE_WINS = {
  1: [1, 2, 3, 5, 7, 10, 14, 20, 28, 38, 50, 65, 85, 110, 140, 180, 230, 290, 370, 500],
  2: [10, 20, 40, 70, 120, 200, 350, 600],
}

export const WORLDS = [
  { id: 1, name: 'World 1', sub: 'Hidden Leaf', rebirths: 0, color: '#3fd14a' },
  { id: 2, name: 'World 2', sub: 'Hidden Sand', rebirths: 2, color: '#ffb02e' },
]

/** 7 Day login calendar. */
export const DAILY_REWARDS = [
  { wins: 5 },
  { speed: 100 },
  { wins: 15 },
  { speed: 300 },
  { wins: 40 },
  { speed: 800 },
  { wins: 100 },
]

/** Playtime gifts, in seconds of this session. */
export const ONLINE_REWARDS = [
  { t: 60, speed: 30 },
  { t: 180, wins: 2 },
  { t: 300, speed: 100 },
  { t: 600, wins: 5 },
  { t: 900, speed: 250 },
  { t: 1200, wins: 10 },
  { t: 1800, speed: 500 },
  { t: 2700, wins: 25 },
  { t: 3600, speed: 1000 },
]

export const REVIVE_WINS = 5
export const CHEST_COOLDOWN_S = 15 * 60

/**
 * Speed points per second of running, before passes / trails / rebirths:
 * +1 at level 1, rising evenly to +15 at level 25.
 */
export function levelGain(level) {
  const l = Math.min(Math.max(level, 1), 25)
  return 1 + Math.round(((l - 1) * 14) / 24)
}

/**
 * Speed points needed to go from `level` to the next. It grows with the per-second
 * gain, so every level still takes a little longer than the last: reaching level 25
 * is a real grind (about two hours of plain running).
 */
export function xpForLevel(level) {
  return Math.round(50 * Math.pow(1.13, level - 1) * levelGain(level))
}

/** Level needed to rebirth. Rebirth sends you back to level 1 (and run speed with it). */
export const REBIRTH_LEVEL = 25

/** Rebirths make each climb a little quicker: more speed points and more wins. */
export function rebirthMultiplier(rebirths) {
  return 1 + rebirths * 0.3
}

export function rebirthWinsMultiplier(rebirths) {
  return 1 + rebirths * 0.25
}

/**
 * Run speed comes only from level, in ten equal steps spread over levels 1-25:
 * from 10 units/s at level 1 up to 20 at the top step.
 */
export const SPEED_TIERS = 10
export const BASE_RUN_SPEED = 10
export const MAX_RUN_SPEED = 20
const TIER_STEP = (MAX_RUN_SPEED - BASE_RUN_SPEED) / (SPEED_TIERS - 1)

export function speedTier(level) {
  const l = Math.min(Math.max(level, 1), REBIRTH_LEVEL)
  return Math.min(SPEED_TIERS - 1, Math.floor(((l - 1) * SPEED_TIERS) / REBIRTH_LEVEL))
}

export function runSpeedForLevel(level) {
  return Math.round((BASE_RUN_SPEED + speedTier(level) * TIER_STEP) * 10) / 10
}

/** First level of the next speed tier, or null at the top tier. */
export function nextTierLevel(level) {
  const tier = speedTier(level)
  if (tier >= SPEED_TIERS - 1) return null
  let l = level
  while (speedTier(l) === tier) l += 1
  return l
}

/**
 * Level needed to go through each stage's gate, spread evenly so the last stage of
 * a world needs level 25: you only finish World 1 once you've climbed all the way.
 */
function spreadLevels(count) {
  return Array.from({ length: count }, (_, i) => Math.round(1 + (i * (REBIRTH_LEVEL - 1)) / (count - 1)))
}
export const STAGE_LEVEL = {
  1: spreadLevels(20),
  2: spreadLevels(8),
}

/** Speed-limiter steps behind the "MAX" gauge. */
export const SPEED_LIMITS = [1, 0.75, 0.5, 0.25]

// Movement
export const GRAVITY = 30
export const JUMP_VELOCITY = 12
export const DASH_TIME = 0.22
export const DASH_BOOST = 38
export const DASH_COOLDOWN = 1.1
export const WALLRUN_MAX_TIME = 4.5
