import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { sfx } from './audio'
import {
  AURA_BY_ID,
  BLOXITY_AVATAR,
  CHARACTER_BY_ID,
  CHARACTERS,
  CHEST_COOLDOWN_S,
  DAILY_REWARDS,
  FX_NAMES,
  levelGain,
  ONLINE_REWARDS,
  PRODUCTS,
  REBIRTH_LEVEL,
  rebirthMultiplier,
  rebirthWinsMultiplier,
  REVIVE_WINS,
  runSpeedForLevel,
  SPEED_LIMITS,
  speedTier,
  STAGE_WINS,
  TRAIL_BY_ID,
  WORLDS,
  xpForLevel,
} from './config'
import { fmt } from './format'
import { spawnFor } from './level/buildWorld'
import { runtime } from './runtime'

let popupId = 0
const DAY_MS = 24 * 60 * 60 * 1000

function dayKey(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** Moves the player to a checkpoint. Applied by the player loop on its next frame. */
function teleport(world, stage) {
  const spawn = spawnFor(world, stage)
  runtime.teleport = { pos: spawn.pos, yaw: spawn.yaw }
  runtime.cameraYaw = spawn.yaw
}

const SAVED_KEYS = [
  'speed',
  'wins',
  'rebirths',
  'level',
  'xp',
  'equipped',
  'owned',
  'trailsOwned',
  'trail',
  'aurasOwned',
  'aura',
  'daily',
  'chestAt',
  'settings',
  'speedLimit',
  'maxStage',
  'totalWins',
  'unlocked',
]

/** Old roster's shop characters -> the new ones, so nobody loses a purchase. */
const OLD_CHARACTER_PRODUCTS = {
  char_threetail: 'char_kitsune',
  char_cursesasuke: 'char_tengu',
  char_kurama: 'char_dragon',
  char_susanoo: 'char_spirit',
}

/** Saves from before the roster change: re-derive unlocks, carry purchases over. */
function migrateRoster(saved) {
  const owned = { ...(saved?.owned || {}) }
  for (const [oldKey, newKey] of Object.entries(OLD_CHARACTER_PRODUCTS)) {
    if (owned[oldKey]) owned[newKey] = true
    delete owned[oldKey]
  }
  const equipped = CHARACTER_BY_ID[saved?.equipped] ? saved.equipped : BLOXITY_AVATAR
  return { ...saved, owned, equipped, unlocked: unlockedFor(saved?.totalWins ?? saved?.wins ?? 0) }
}

/** Characters whose win requirement `wins` meets. Unlocks are permanent. */
const unlockedFor = (wins) => CHARACTERS.filter((c) => !c.product && wins >= c.wins).map((c) => c.id)

export const useGameStore = create(
  persist(
    (set, get) => ({
      // --- saved progress ----------------------------------------------------
      speed: 0,
      wins: 0,
      totalWins: 0,
      rebirths: 0,
      level: 1,
      xp: 0,
      /** A character id, or BLOXITY_AVATAR for the player's own Bloxity avatar. */
      equipped: BLOXITY_AVATAR,
      /** Shop passes owned. */
      owned: {},
      trailsOwned: ['none'],
      trail: 'none',
      /** Aura shown on the Bloxity avatar (characters bring their own). */
      aurasOwned: ['none'],
      aura: 'none',
      daily: { next: 0, last: 0 },
      chestAt: 0,
      settings: {
        popups: true,
        sfx: true,
        music: true,
        adCamera: true,
        shadows: true,
      },
      /** Win-unlocked characters stay unlocked even after spending wins. */
      unlocked: ['kaito'],
      speedLimit: 0,
      maxStage: { 1: 0, 2: 0 },

      // --- session only ------------------------------------------------------
      world: 1,
      stage: 0,
      playSeconds: 0,
      onlineClaimed: [],
      panel: null,
      reviveOpen: false,
      popups: [],
      bigPopups: [],
      toasts: [],
      leaderboard: { wins: [], speed: [] },
      /** Walked into a stage gate below its level: { req, stage, at }, shown as a notice. */
      gateNotice: null,
      /** The world is built and the first frame is on screen (hides the loading screen). */
      loaded: false,
      /**
       * The Bloxity session is known and, when signed in, the account's progress has
       * been loaded. The game opens only then, already as the right player.
       */
      accountReady: false,

      /* ---------------- derived helpers ---------------- */

      /** Speed points per second of running: grows with level, not with characters. */
      speedPerTick() {
        const s = get()
        const trail = TRAIL_BY_ID[s.trail] || TRAIL_BY_ID.none
        return levelGain(s.level) * rebirthMultiplier(s.rebirths) * (s.owned.x2speed ? 2 : 1) * (1 + trail.boost)
      },

      /* ---------------- core loop ---------------- */

      /** Once per second. Gains speed only while running or on a treadmill. */
      tick() {
        const s = get()
        set({ playSeconds: s.playSeconds + 1 })
        if (runtime.dead) return
        const moving = performance.now() - runtime.lastMoveAt < 1100 || runtime.treadmill > 0
        if (!moving) return
        const gain = Math.max(1, Math.round(s.speedPerTick() * Math.max(1, runtime.treadmill)))
        get().addSpeed(gain, true)
        if (s.settings.popups) get().speedPopup(gain)
      },

      addSpeed(amount, withXp) {
        const s = get()
        let { level, xp } = s
        if (withXp) {
          xp += amount
          let need = xpForLevel(level)
          let leveled = false
          while (xp >= need) {
            xp -= need
            level += 1
            need = xpForLevel(level)
            leveled = true
          }
          if (leveled) {
            runtime.levelUpFx = performance.now()
            get().bigPopup(`Level ${level}!`, '#5fd0ff')
            sfx('level')
            if (speedTier(level) > speedTier(s.level)) {
              get().toast(`Run speed up! Now ${runSpeedForLevel(level)}`, 'good')
            }
            if (level >= REBIRTH_LEVEL && s.level < REBIRTH_LEVEL) {
              get().toast('Level 25! You can Rebirth now (R)', 'good')
            }
          }
        }
        set({ speed: s.speed + amount, level, xp })
      },

      addWins(amount) {
        const s = get()
        const wins = s.wins + amount
        const fresh = unlockedFor(wins).filter((id) => !s.unlocked.includes(id))
        set({
          wins,
          totalWins: s.totalWins + Math.max(0, amount),
          unlocked: fresh.length ? [...s.unlocked, ...fresh] : s.unlocked,
        })
        for (const id of fresh) {
          get().toast(`NEW SHINOBI: ${CHARACTER_BY_ID[id].name}!`, 'good')
        }
      },

      grant(reward) {
        if (!reward) return
        if (reward.speed) get().addSpeed(reward.speed, true)
        if (reward.wins) get().addWins(reward.wins)
      },

      /* ---------------- stages ---------------- */

      reachStage(world, stage) {
        const s = get()
        if (s.world !== world) return
        const best = s.maxStage[world] || 0
        set({
          stage,
          maxStage: stage > best ? { ...s.maxStage, [world]: stage } : s.maxStage,
        })
      },

      claimStageWin(world, stage) {
        const s = get()
        const base = STAGE_WINS[world]?.[stage - 1] ?? 1
        const wins = Math.round(base * (s.owned.x2wins ? 2 : 1) * rebirthWinsMultiplier(s.rebirths))
        get().addWins(wins)
        get().bigPopup(`+${fmt(wins)} Win${wins === 1 ? '' : 's'}`, '#ffe01f', true)
        sfx('win')
        set({ stage: 0 })
        teleport(world, 0)
        // Trophies rain down around the player back in the lobby.
        runtime.winRain = { at: performance.now(), amount: wins, pos: spawnFor(world, 0).pos }
        setTimeout(() => sfx('coins'), 350)
      },

      goToStage(stage) {
        const s = get()
        const max = s.maxStage[s.world] || 0
        const target = Math.max(0, Math.min(stage, max))
        set({ stage: target })
        teleport(s.world, target)
      },

      goToWorld(world) {
        const s = get()
        const def = WORLDS.find((w) => w.id === world)
        if (!def) return false
        if (s.rebirths < def.rebirths) {
          get().toast(`You need ${def.rebirths} Rebirths to enter ${def.name}!`, 'error')
          sfx('error')
          return false
        }
        set({ world, stage: 0, panel: null })
        teleport(world, 0)
        sfx('portal')
        return true
      },

      /** Back to the lobby of the current world (the locked-gate notice's button). */
      goLobby() {
        const s = get()
        set({ stage: 0, gateNotice: null })
        teleport(s.world, 0)
        sfx('portal')
      },

      /** The gate of `stage` won't open below level `req`. Shown at most every few seconds. */
      gateLocked(req, stage) {
        const cur = get().gateNotice
        const at = performance.now()
        if (cur && cur.stage === stage && at - cur.at < 2500) return
        set({ gateNotice: { req, stage, at } })
        sfx('locked')
        setTimeout(() => {
          if (get().gateNotice?.at === at) set({ gateNotice: null })
        }, 5000)
      },

      respawn() {
        const s = get()
        teleport(s.world, s.stage)
      },

      /* ---------------- death & revive ---------------- */

      die() {
        if (runtime.dead) return
        runtime.dead = true
        sfx('death')
        // In the lobby there is nothing to lose, so skip the revive prompt.
        if (get().stage === 0) {
          setTimeout(() => get().revive('lobby'), 600)
          return
        }
        set({ reviveOpen: true })
      },

      /** mode: 'wins' | 'lobby' */
      revive(mode) {
        const s = get()
        if (mode === 'wins') {
          if (s.wins < REVIVE_WINS) return
          set({ wins: s.wins - REVIVE_WINS })
        }
        const stage = mode === 'lobby' ? 0 : s.stage
        set({ reviveOpen: false, stage })
        teleport(s.world, stage)
        runtime.dead = false
      },

      /* ---------------- characters ---------------- */

      canEquip(id) {
        if (id === BLOXITY_AVATAR) return true
        const def = CHARACTER_BY_ID[id]
        if (!def) return false
        const s = get()
        if (def.product) return Boolean(s.owned[def.product])
        return s.unlocked.includes(id) || s.wins >= def.wins
      },

      equip(id) {
        const s = get()
        if (id === BLOXITY_AVATAR) {
          if (s.equipped === id) return
          set({ equipped: id })
          get().toast('Back to your Bloxity avatar', 'good')
          sfx('equip')
          return
        }
        const def = CHARACTER_BY_ID[id]
        if (!def || s.equipped === id) return
        if (!s.canEquip(id)) {
          if (!def.product) {
            get().toast(`You need ${fmt(def.wins)} Wins to equip ${def.name}!`, 'error')
            sfx('error')
          }
          return
        }
        set({ equipped: id })
        get().toast(`Equipped ${def.name}  (${FX_NAMES[def.fx]})`, 'good')
        sfx('equip')
      },

      /* ---------------- rebirth ---------------- */

      rebirth() {
        const s = get()
        if (s.level < REBIRTH_LEVEL) {
          get().toast(`Reach Level ${REBIRTH_LEVEL} to rebirth!`, 'error')
          sfx('error')
          return
        }
        // Level (and with it run speed) and speed points start over; wins,
        // characters, trails and passes stay.
        set({ speed: 0, level: 1, xp: 0, rebirths: s.rebirths + 1, stage: 0, panel: null })
        teleport(s.world, 0)
        runtime.rebirthFx = performance.now()
        get().bigPopup('REBIRTH!', '#ff4fd8', true)
        sfx('rebirth')
      },

      /* ---------------- trails ---------------- */

      buyTrail(id) {
        const s = get()
        const t = TRAIL_BY_ID[id]
        if (!t || s.trailsOwned.includes(id)) return false
        if (t.product) return false
        if (s.wins < t.cost) {
          get().toast(`You need ${fmt(t.cost)} Wins!`, 'error')
          sfx('error')
          return false
        }
        set({ wins: s.wins - t.cost, trailsOwned: [...s.trailsOwned, id], trail: id })
        sfx('buy')
        return true
      },

      equipTrail(id) {
        const s = get()
        const owned = s.trailsOwned.includes(id) || (id === 'rainbow' && s.owned.rainbowtrail)
        if (!owned) return
        set({ trail: id })
        sfx('equip')
      },

      /* ---------------- auras ---------------- */

      buyAura(id) {
        const s = get()
        const a = AURA_BY_ID[id]
        if (!a || s.aurasOwned.includes(id)) return false
        if (s.wins < a.cost) {
          get().toast(`You need ${fmt(a.cost)} Wins!`, 'error')
          sfx('error')
          return false
        }
        set({ wins: s.wins - a.cost, aurasOwned: [...s.aurasOwned, id], aura: id })
        get().toast(`${a.name} unlocked!`, 'good')
        sfx('buy')
        return true
      },

      equipAura(id) {
        const s = get()
        if (!s.aurasOwned.includes(id) || s.aura === id) return
        set({ aura: id })
        sfx('equip')
      },

      /* ---------------- rewards ---------------- */

      dailyState(now = Date.now()) {
        const { daily } = get()
        const claimedToday = daily.last && dayKey(daily.last) === dayKey(now)
        // Missing a whole day resets the streak.
        const broken = daily.last && now - daily.last > 2 * DAY_MS
        const next = broken ? 0 : daily.next % DAILY_REWARDS.length
        return { canClaim: !claimedToday, next }
      },

      claimDaily() {
        const st = get().dailyState()
        if (!st.canClaim) return
        get().grant(DAILY_REWARDS[st.next])
        set({ daily: { next: st.next + 1, last: Date.now() } })
        sfx('buy')
      },

      claimOnline(index) {
        const s = get()
        const r = ONLINE_REWARDS[index]
        if (!r || s.onlineClaimed.includes(index) || s.playSeconds < r.t) return
        get().grant(r)
        set({ onlineClaimed: [...s.onlineClaimed, index] })
        sfx('buy')
      },

      claimChest() {
        const s = get()
        const now = Date.now()
        if (now < s.chestAt) {
          get().toast(`Chest ready in ${Math.ceil((s.chestAt - now) / 60000)} min`, 'error')
          return
        }
        const amount = Math.max(60, Math.round(s.speedPerTick() * 60))
        get().addSpeed(amount, true)
        set({ chestAt: now + CHEST_COOLDOWN_S * 1000 })
        get().bigPopup(`+${fmt(amount)} Speed`, '#39e34a')
        sfx('win')
      },

      /* ---------------- purchases ---------------- */

      /** Buys a shop item with wins. Returns whether it went through. */
      buy(key) {
        const p = PRODUCTS[key]
        const s = get()
        if (!p) return false
        if (p.kind === 'pass' && s.owned[key]) return true
        if (s.wins < p.price) {
          get().toast(`You need ${fmt(p.price)} Wins for ${p.name}!`, 'error')
          sfx('error')
          return false
        }
        set({ wins: s.wins - p.price })
        if (p.kind === 'pass') set({ owned: { ...get().owned, [key]: true } })
        if (p.grant) get().grant(p.grant)
        if (key === 'rainbowtrail') set({ trail: 'rainbow' })
        const charDef = Object.values(CHARACTER_BY_ID).find((c) => c.product === key)
        if (charDef) set({ equipped: charDef.id })
        sfx('buy')
        return true
      },

      /* ---------------- settings / ui ---------------- */

      setSetting(key, value) {
        set({ settings: { ...get().settings, [key]: value } })
      },

      cycleSpeedLimit() {
        set({ speedLimit: (get().speedLimit + 1) % SPEED_LIMITS.length })
        sfx('click')
      },

      openPanel(panel) {
        set({ panel: get().panel === panel ? null : panel })
        sfx('click')
      },
      closePanel() {
        set({ panel: null })
      },

      speedPopup(amount) {
        const id = popupId++
        // Scattered all over the screen, like the original's "+1" rain.
        const x = (Math.random() - 0.5) * 70
        const y = 22 + Math.random() * 45
        set({ popups: [...get().popups.slice(-10), { id, text: `+${fmt(amount)}`, x, y }] })
        setTimeout(() => set({ popups: get().popups.filter((p) => p.id !== id) }), 1300)
      },

      bigPopup(text, color = '#ffe01f', huge = false) {
        const id = popupId++
        set({ bigPopups: [...get().bigPopups.slice(-2), { id, text, color, huge }] })
        setTimeout(() => set({ bigPopups: get().bigPopups.filter((p) => p.id !== id) }), 1800)
      },

      toast(text, kind = 'info') {
        const id = popupId++
        set({ toasts: [...get().toasts.slice(-3), { id, text, kind }] })
        setTimeout(() => set({ toasts: get().toasts.filter((p) => p.id !== id) }), 2600)
      },

      /* ---------------- account save ---------------- */

      /** The saved progress, for storing on the player's account. */
      exportSave() {
        const s = get()
        return Object.fromEntries(SAVED_KEYS.map((k) => [k, s[k]]))
      },

      /** Loads progress from the player's account, replacing what this browser had. */
      applySave(raw) {
        if (!raw || typeof raw !== 'object') return
        const data = raw.equipped && raw.equipped !== BLOXITY_AVATAR && !CHARACTER_BY_ID[raw.equipped] ? migrateRoster(raw) : raw
        const s = get()
        const next = {}
        for (const k of SAVED_KEYS) if (data[k] !== undefined) next[k] = data[k]
        next.settings = { ...s.settings, ...(data.settings || {}) }
        next.maxStage = { ...s.maxStage, ...(data.maxStage || {}) }
        if (next.equipped !== BLOXITY_AVATAR && !CHARACTER_BY_ID[next.equipped]) next.equipped = BLOXITY_AVATAR
        set({ ...next, stage: 0 })
        teleport(s.world, 0)
      },

      setLeaderboard(leaderboard) {
        set({ leaderboard })
      },
    }),
    {
      name: 'shinobi-escape-save-v1',
      // v2: players start as their own Bloxity avatar. v3: new character roster.
      version: 3,
      migrate: (saved, version) => {
        let out = saved
        if (version < 2) out = { ...out, equipped: BLOXITY_AVATAR }
        if (version < 3) out = migrateRoster(out)
        return out
      },
      partialize: (s) => Object.fromEntries(SAVED_KEYS.map((k) => [k, s[k]])),
      merge: (saved, current) => ({
        ...current,
        ...(saved || {}),
        settings: { ...current.settings, ...(saved?.settings || {}) },
        maxStage: { ...current.maxStage, ...(saved?.maxStage || {}) },
        // Older saves had no unlock list: derive it from the wins they hold.
        unlocked: saved?.unlocked ?? unlockedFor(saved?.wins ?? 0),
      }),
    },
  ),
)

export const getGame = () => useGameStore.getState()
