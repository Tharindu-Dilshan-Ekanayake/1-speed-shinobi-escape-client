import { useEffect, useRef, useState } from 'react'

import {
  BLOXITY_AVATAR,
  nextTierLevel,
  PRODUCTS,
  REBIRTH_LEVEL,
  runSpeedForLevel,
  SPEED_LIMITS,
  xpForLevel,
} from '../game/config'
import { fmt } from '../game/format'
import { getGame, useGameStore } from '../game/gameStore'
import { purchase } from '../game/monetization'
import { runtime } from '../game/runtime'
import { LightningIcon, ShoeIcon, TrophyIcon, WinsPrice } from './Icons'

/* ------------------------------------------------------------------------ */
/* Keyboard shortcuts (the key is shown on each button's top-left corner)     */
/* ------------------------------------------------------------------------ */

const PACKS = [
  ['speed250', '+250', '1'],
  ['speed1k', '+1k', '2'],
  ['speed5k', '+5k', '3'],
  ['speed20k', '+20k', '4'],
]

const SHORTCUTS = {
  KeyR: () => getGame().openPanel('rebirth'),
  KeyT: () => getGame().openPanel('trails'),
  KeyU: () => getGame().openPanel('auras'),
  KeyL: () => getGame().gateNotice && getGame().goLobby(),
  KeyG: () => getGame().openPanel('daily'),
  KeyM: () => getGame().openPanel('worlds'),
  KeyV: () => getGame().equip(BLOXITY_AVATAR),
  KeyN: () => toggleSound(),
  KeyQ: () => getGame().cycleSpeedLimit(),
  KeyX: () => !getGame().owned.x2speed && purchase('x2speed'),
  ...Object.fromEntries(PACKS.map(([key, , k]) => [`Digit${k}`, () => purchase(key)])),
}

/** One switch for all game sound: effects and music together. */
function toggleSound() {
  const g = getGame()
  const on = !(g.settings.sfx || g.settings.music)
  g.setSetting('sfx', on)
  g.setSetting('music', on)
}

function SoundButton() {
  const on = useGameStore((s) => s.settings.sfx || s.settings.music)
  return (
    <button
      type="button"
      onClick={toggleSound}
      title="Sound on / off"
      className="rbx-btn pointer-events-auto absolute bottom-[1.2rem] right-[1.4rem] flex h-[4.8rem] w-[4.8rem] items-center justify-center text-[2.6rem]"
      style={{ background: on ? 'linear-gradient(180deg,#5fe08a,#1fa84a)' : 'linear-gradient(180deg,#ff7a7a,#d8202a)' }}
    >
      <KeyBadge label="N" />
      {on ? '🔊' : '🔇'}
    </button>
  )
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (getGame().reviveOpen) return
      SHORTCUTS[e.code]?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** Small keyboard-shortcut chip pinned to a button's top-left corner. */
function KeyBadge({ label }) {
  return (
    <span className="pointer-events-none absolute -left-[0.6rem] -top-[0.6rem] z-10 flex h-[2.1rem] min-w-[2.1rem] items-center justify-center rounded-md border-[0.2rem] border-[#151515] bg-[#ffe01f] px-[0.3rem] font-[Fredoka,system-ui,sans-serif] text-[1.3rem] font-bold leading-none text-[#151515] shadow-[0_0.15rem_0_rgba(0,0,0,0.4)]">
      {label}
    </span>
  )
}

/* ------------------------------------------------------------------------ */
/* Left: wins + menu tiles                                                   */
/* ------------------------------------------------------------------------ */

function Tile({ label, icon, from, to, onClick, badge, hotkey }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rbx-btn studs flex h-[6.6rem] w-[6.6rem] flex-col items-center justify-end pb-[0.2rem]"
      style={{ background: `linear-gradient(180deg, ${from}, ${to})` }}
    >
      <KeyBadge label={hotkey} />
      <span className="absolute top-[0.5rem] text-[2.9rem] leading-none drop-shadow-[0_0.2rem_0_rgba(0,0,0,0.4)]">{icon}</span>
      <span className="rbx-text relative text-[1.4rem]">{label}</span>
      {badge && (
        <span className="pulse-badge rbx-text absolute -right-[0.7rem] -top-[0.7rem] flex h-[2.2rem] w-[2.2rem] items-center justify-center rounded-lg border-[0.25rem] border-[#151515] bg-[#ff2f3a] text-[1.4rem]">
          !
        </span>
      )}
    </button>
  )
}

function LeftColumn() {
  const wins = useGameStore((s) => s.wins)
  const openPanel = useGameStore((s) => s.openPanel)
  const dailyReady = useGameStore((s) => s.dailyState().canClaim)
  const rebirthReady = useGameStore((s) => s.level >= REBIRTH_LEVEL)
  const onAvatar = useGameStore((s) => s.equipped === BLOXITY_AVATAR)
  const equip = useGameStore((s) => s.equip)

  return (
    <div className="pointer-events-none absolute left-[1.4rem] top-[10rem] flex flex-col gap-3">
      <div className="flex w-[14rem] items-center justify-between">
        <div className="flex items-center gap-2">
          <TrophyIcon className="h-[3.2rem] w-[3.2rem]" />
          <span className="rbx-text text-[2.8rem]">{fmt(wins)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-[0.8rem]">
        <Tile label="Rebirth" icon="🔄" hotkey="R" from="#5fe0ff" to="#1f9fe0" onClick={() => openPanel('rebirth')} badge={rebirthReady} />
        <Tile label="Trails" icon="🔥" hotkey="T" from="#d77bff" to="#8a2ad8" onClick={() => openPanel('trails')} />
        <Tile label="7 Day" icon="📅" hotkey="G" from="#ff6a6a" to="#d8141f" onClick={() => openPanel('daily')} badge={dailyReady} />
        <Tile label="Worlds" icon="🌍" hotkey="M" from="#6fe0ff" to="#1f9fe0" onClick={() => openPanel('worlds')} />
        <Tile label="Aura" icon="✨" hotkey="U" from="#ffe36a" to="#ff8a1f" onClick={() => openPanel('auras')} />
        <Tile
          label="Avatar"
          icon="🧍"
          hotkey="V"
          from={onAvatar ? '#9fe8a8' : '#ffd86a'}
          to={onAvatar ? '#2cb85a' : '#f08a1a'}
          onClick={() => equip(BLOXITY_AVATAR)}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Right: passes, speed limiter, x2 speed, dash                              */
/* ------------------------------------------------------------------------ */

function SpeedGauge() {
  const limit = useGameStore((s) => s.speedLimit)
  const cycle = useGameStore((s) => s.cycleSpeedLimit)
  const value = SPEED_LIMITS[limit]
  const angle = -80 + value * 160
  return (
    <button type="button" onClick={cycle} title="Speed limiter" className="pointer-events-auto flex flex-col items-center transition hover:scale-105">
      <div className="rbx-btn relative flex h-[3.6rem] w-[9.4rem] items-center justify-center bg-[#3a3d44]">
        <KeyBadge label="Q" />
        <span className="rbx-text text-[2.4rem] text-[#ff2f3a]">{value === 1 ? 'MAX' : `${Math.round(value * 100)}%`}</span>
      </div>
      <div className="relative -mt-[0.5rem] h-[3.4rem] w-[6.8rem] overflow-hidden">
        <div
          className="absolute left-0 top-0 h-[6.8rem] w-[6.8rem] rounded-full border-[0.3rem] border-[#151515]"
          style={{ background: 'conic-gradient(from -90deg, #3fe04a 0deg, #ffe01f 90deg, #ff2f3a 180deg, transparent 180deg)' }}
        />
        <div
          className="absolute bottom-0 left-1/2 h-[2.9rem] w-[0.45rem] origin-bottom rounded bg-[#1f6bff] shadow-[0_0_0_0.15rem_#151515]"
          style={{ transform: `translateX(-50%) rotate(${angle}deg)` }}
        />
        <div className="absolute -bottom-[0.8rem] left-1/2 h-[1.5rem] w-[1.5rem] -translate-x-1/2 rounded-full border-[0.25rem] border-[#151515] bg-white" />
      </div>
    </button>
  )
}

function X2SpeedButton() {
  const owned = useGameStore((s) => Boolean(s.owned.x2speed))
  if (owned) return null
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => purchase('x2speed')}
        className="rbx-btn hazard relative flex h-[5rem] w-[15.5rem] items-center justify-center bg-linear-to-b from-[#ffe23a] to-[#ff9a1a]"
      >
        <KeyBadge label="X" />
        <span className="rbx-text text-[2.8rem]">x2 Speed</span>
      </button>
      <span className="rbx-text -mt-[0.1rem] flex items-center gap-2 text-[1.8rem] text-[#ffe23a]">
        ONLY <WinsPrice price={fmt(PRODUCTS.x2speed.price)} />
      </span>
    </div>
  )
}

function DashButton() {
  const [cooldown, setCooldown] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setCooldown(runtime.dashCooldown), 100)
    return () => clearInterval(id)
  }, [])
  const ready = cooldown <= 0
  return (
    <button
      type="button"
      onClick={() => (runtime.dashRequest = true)}
      className="pointer-events-auto relative flex flex-col items-center transition hover:scale-105"
      style={{ opacity: ready ? 1 : 0.55 }}
    >
      <span className="relative flex h-[4.6rem] w-[4.6rem] items-center justify-center rounded-xl border-[0.3rem] border-[#8a8f98] bg-linear-to-b from-white to-[#d8dce4] text-[2.5rem] shadow-[0_0.3rem_0_#6a6f78]">
        <KeyBadge label="E" />⚡
      </span>
      <span className="rbx-text rbx-text-thin mt-1 text-[1.6rem]">{ready ? 'DASH' : cooldown.toFixed(1)}</span>
    </button>
  )
}

function RightColumn() {
  return (
    <>
      <div className="pointer-events-none absolute right-[2rem] top-[15rem] flex flex-col items-center gap-3">
        <SpeedGauge />
        <X2SpeedButton />
      </div>
      <div className="pointer-events-none absolute right-[5.5rem] top-[33rem]">
        <DashButton />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------------ */
/* Bottom: speed, level bar, speed packs                                     */
/* ------------------------------------------------------------------------ */

function BottomCenter() {
  const speed = useGameStore((s) => s.speed)
  const level = useGameStore((s) => s.level)
  const xp = useGameStore((s) => s.xp)
  const need = xpForLevel(level)
  const pct = Math.min(1, xp / need)
  const run = runSpeedForLevel(level)
  const nextAt = nextTierLevel(level)
  let tierNote = '  ·  MAX'
  if (nextAt) tierNote = `  ·  faster at Level ${nextAt}`
  else if (level >= REBIRTH_LEVEL) tierNote = '  ·  MAX! Rebirth ready (R)'
  return (
    <div className="pointer-events-none absolute bottom-[1rem] left-1/2 flex -translate-x-1/2 flex-col items-center">
      <div className="rbx-text text-[3rem] leading-tight">Speed: {fmt(speed)}</div>
      <div className="rbx-text rbx-text-thin mb-1 text-[1.5rem] text-[#dff6ff]">
        Run speed {run}
        {tierNote}
      </div>
      <div className="relative flex h-[4.8rem] w-[44rem] items-center">
        <ShoeIcon className="absolute -left-[1.3rem] z-10 h-[5.9rem] w-[6.4rem] -rotate-12" />
        <div className="studs relative ml-[1.6rem] h-[4.2rem] flex-1 overflow-hidden rounded-[1.2rem] border-[0.3rem] border-[#151515] bg-linear-to-b from-[#f4f8ff] to-[#c9d6ea]">
          <div
            className="studs h-full bg-linear-to-b from-[#48b8ff] to-[#1a7bd8] transition-[width] duration-300"
            style={{ width: `${Math.max(4, pct * 100)}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-between pl-[4.8rem] pr-[3rem]">
            <span className="rbx-text text-[2.5rem]">Level {level}</span>
            <span className="rbx-text text-[2.5rem]">
              {fmt(xp)}/{fmt(need)}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-3">
        {PACKS.map(([key, label, hotkey]) => (
          <button
            key={key}
            type="button"
            onClick={() => purchase(key)}
            className="rbx-btn relative flex h-[5.4rem] w-[9.6rem] flex-col items-center justify-center overflow-visible bg-linear-to-b from-[#ffb84a] via-[#ff8a1f] to-[#e8560f] pb-[0.2rem]"
          >
            <KeyBadge label={hotkey} />
            <span className="flex items-center gap-[0.2rem]">
              <LightningIcon className="h-[2rem] w-[1.4rem]" />
              <span className="rbx-text text-[2.3rem] leading-none">{label}</span>
            </span>
            <span className="mt-[0.35rem] flex items-center gap-[0.25rem] rounded-full bg-black/35 px-[0.7rem] py-[0.15rem] text-[1.25rem] font-bold leading-none text-[#ffe23a]">
              <TrophyIcon className="h-[1.3rem] w-[1.3rem]" />
              {fmt(PRODUCTS[key].price)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Popups and toasts                                                         */
/* ------------------------------------------------------------------------ */

function Popups() {
  const popups = useGameStore((s) => s.popups)
  const bigPopups = useGameStore((s) => s.bigPopups)
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {popups.map((p) => (
        <div
          key={p.id}
          className="spd-popup absolute flex items-center gap-1"
          style={{ left: `calc(50% + ${p.x}vw)`, top: `${p.y}%` }}
        >
          <LightningIcon className="h-[3rem] w-[2.2rem]" />
          <span className="rbx-text text-[4.4rem] italic">{p.text}</span>
        </div>
      ))}
      {bigPopups.map((p) => (
        <div
          key={p.id}
          className="big-popup rbx-text absolute left-1/2 top-[62%] whitespace-nowrap"
          style={{ color: p.color, fontSize: p.huge ? '11rem' : '6rem' }}
        >
          {p.text}
        </div>
      ))}
    </div>
  )
}

function Toasts() {
  const toasts = useGameStore((s) => s.toasts)
  const colors = { error: '#ff3a3a', good: '#27d84a', info: '#27b6ff' }
  return (
    <div className="pointer-events-none absolute left-1/2 top-[15rem] z-30 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast rbx-text rbx-text-thin rounded-xl border-[0.3rem] border-[#151515] px-5 py-2 text-[1.9rem]"
          style={{ background: colors[t.kind] || colors.info }}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}

/**
 * Walked into a stage gate below its level: a small card under the top bar with a
 * padlock, what level is needed and a button straight back to the lobby.
 */
function GateNotice() {
  const notice = useGameStore((s) => s.gateNotice)
  const level = useGameStore((s) => s.level)
  const goLobby = useGameStore((s) => s.goLobby)
  if (!notice) return null
  const pct = Math.min(100, Math.round((level / notice.req) * 100))
  return (
    <div className="pointer-events-none absolute left-1/2 top-[9.5rem] z-30 -translate-x-1/2">
      <div
        key={notice.at}
        className="gate-notice pointer-events-auto relative flex items-center gap-4 rounded-[1.4rem] border-[0.3rem] border-[#151515] px-5 py-3"
        style={{
          background: 'linear-gradient(180deg, rgba(40,12,24,0.94), rgba(20,8,20,0.94))',
          boxShadow: '0 0 0 0.25rem #ff3848, 0 0.6rem 2.4rem rgba(255,56,72,0.45)',
        }}
      >
        <div className="lock-shake flex h-[5.2rem] w-[5.2rem] shrink-0 items-center justify-center rounded-full border-[0.25rem] border-[#151515] bg-gradient-to-b from-[#ff6a74] to-[#d8142a] text-[2.8rem]">
          🔒
        </div>
        <div className="flex min-w-[21rem] flex-col gap-[0.35rem]">
          <div className="rbx-text text-[2.1rem] leading-none text-[#ff5a66]">Stage {notice.stage} is locked</div>
          <div className="rbx-text rbx-text-thin text-[1.45rem] leading-tight text-white">
            Reach <span className="text-[#ffe23a]">Level {notice.req}</span> to enter · you&apos;re Level {level}
          </div>
          <div className="h-[0.9rem] w-full overflow-hidden rounded-full border-[0.18rem] border-[#151515] bg-[#3a2030]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#ffe23a] to-[#ff8a1f]" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={goLobby}
          className="rbx-btn rbx-text relative flex h-[4.6rem] shrink-0 items-center gap-2 px-4 text-[1.5rem] leading-tight"
          style={{ background: 'linear-gradient(180deg,#5fe08a,#1fa84a)' }}
        >
          <KeyBadge label="L" />
          <span className="text-[2rem]">🏠</span>
          <span className="text-left">
            Go Lobby
            <br />& Level Up
          </span>
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------ */
/* Touch controls                                                            */
/* ------------------------------------------------------------------------ */

function TouchControls() {
  const [touch] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches)
  const base = useRef(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  if (!touch) return null

  const move = (e) => {
    const r = base.current.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    let dx = (e.clientX - cx) / (r.width / 2)
    let dy = (e.clientY - cy) / (r.height / 2)
    const len = Math.hypot(dx, dy)
    if (len > 1) {
      dx /= len
      dy /= len
    }
    runtime.touchMove.x = dx
    runtime.touchMove.y = -dy
    setKnob({ x: dx, y: dy })
  }
  const end = () => {
    runtime.touchMove.x = 0
    runtime.touchMove.y = 0
    setKnob({ x: 0, y: 0 })
  }
  return (
    <>
      <div
        ref={base}
        className="pointer-events-auto absolute bottom-[4rem] left-[4rem] z-30 h-[14rem] w-[14rem] rounded-full border-[0.4rem] border-white/60 bg-black/25"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          move(e)
        }}
        onPointerMove={(e) => e.buttons && move(e)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div
          className="absolute left-1/2 top-1/2 h-[6rem] w-[6rem] rounded-full bg-white/70"
          style={{ transform: `translate(calc(-50% + ${knob.x * 4}rem), calc(-50% + ${knob.y * 4}rem))` }}
        />
      </div>
      <button
        type="button"
        onPointerDown={() => (runtime.jumpRequest = true)}
        className="pointer-events-auto absolute bottom-[5rem] right-[5rem] z-30 h-[11rem] w-[11rem] rounded-full border-[0.4rem] border-white/60 bg-black/25 text-[4rem] text-white"
      >
        ⤒
      </button>
    </>
  )
}

/**
 * Anime speed lines: radial streaks around the screen edge that fade in with speed.
 * Updated straight from requestAnimationFrame, so running never re-renders React.
 */
function SpeedLines() {
  const el = useRef(null)
  useEffect(() => {
    let raf = 0
    let spin = 0
    const loop = () => {
      const k = Math.max(0, (runtime.speedRatio - 0.4) / 0.6)
      if (el.current) {
        spin = (spin + 7) % 360
        el.current.style.opacity = String(runtime.dead ? 0 : k * 0.55)
        el.current.style.transform = `rotate(${spin}deg) scale(1.6)`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div
        ref={el}
        className="absolute inset-0"
        style={{
          opacity: 0,
          background:
            'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.9) 0deg 0.6deg, transparent 0.6deg 7deg)',
          WebkitMaskImage: 'radial-gradient(circle at center, transparent 32%, black 62%)',
          maskImage: 'radial-gradient(circle at center, transparent 32%, black 62%)',
        }}
      />
    </div>
  )
}

const DROPS = Array.from({ length: 46 }, (_, i) => ({
  left: ((i * 37) % 100) + ((i * 13) % 7) / 7,
  delay: ((i * 29) % 100) / 100 * 1.4,
  dur: 1.8 + ((i * 17) % 10) / 10,
  size: 2.6 + ((i * 11) % 5) * 0.6,
  spin: (i % 2 ? 1 : -1) * (200 + ((i * 53) % 300)),
}))

/** Trophies pouring down the whole screen when a stage win sends you to the lobby. */
function WinRainOverlay() {
  const [rainAt, setRainAt] = useState(0)
  useEffect(() => {
    let raf = 0
    let seen = runtime.winRain?.at ?? 0
    let clear = 0
    const loop = () => {
      const at = runtime.winRain?.at ?? 0
      if (at !== seen) {
        seen = at
        setRainAt(at)
        clearTimeout(clear)
        clear = setTimeout(() => setRainAt(0), 4200)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(clear)
    }
  }, [])
  if (!rainAt) return null
  return (
    <div key={rainAt} className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {DROPS.map((d, i) => (
        <span
          key={i}
          className="win-drop absolute top-0"
          style={{ left: `${d.left}%`, '--delay': `${d.delay}s`, '--dur': `${d.dur}s`, '--spin': `${d.spin}deg` }}
        >
          <TrophyIcon className="drop-shadow-[0_0.2rem_0.2rem_rgba(0,0,0,0.35)]" style={{ width: `${d.size}rem`, height: `${d.size}rem` }} />
        </span>
      ))}
    </div>
  )
}

export function Hud() {
  useShortcuts()
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <SpeedLines />
      <WinRainOverlay />
      <LeftColumn />
      <RightColumn />
      <SoundButton />
      <BottomCenter />
      <Popups />
      <Toasts />
      <GateNotice />
      <TouchControls />
    </div>
  )
}

export default Hud
