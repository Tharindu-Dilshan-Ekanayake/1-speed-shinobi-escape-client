import { useEffect, useState } from 'react'

import {
  AURAS,
  BLOXITY_AVATAR,
  CHARACTER_BY_ID,
  DAILY_REWARDS,
  MAX_RUN_SPEED,
  PRODUCTS,
  REBIRTH_LEVEL,
  rebirthMultiplier,
  rebirthWinsMultiplier,
  REVIVE_WINS,
  runSpeedForLevel,
  TRAILS,
  WORLDS,
} from '../game/config'
import { fmt } from '../game/format'
import { useGameStore } from '../game/gameStore'
import { purchase } from '../game/monetization'
import { WinsPrice } from './Icons'

/* ------------------------------------------------------------------------ */
/* Shell                                                                     */
/* ------------------------------------------------------------------------ */

function Modal({ title, color = '#27b6ff', icon, onClose, children, width = '58rem' }) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/35">
      <div
        className="panel-in relative overflow-hidden rounded-[1.6rem] border-[0.4rem] border-[#151515] bg-white shadow-2xl"
        style={{ width, maxWidth: '94vw', maxHeight: '86vh' }}
      >
        <div className="studs relative flex items-center gap-3 border-b-[0.4rem] border-[#151515] px-6 py-4" style={{ background: color }}>
          {icon && <span className="text-[3rem] leading-none">{icon}</span>}
          <h2 className="rbx-text flex-1 text-[3.4rem]">{title}</h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rbx-btn rbx-text flex h-[4.2rem] w-[4.2rem] items-center justify-center bg-[#ff2f3a] text-[2.6rem]"
            >
              X
            </button>
          )}
        </div>
        <div className="studs-dark max-h-[68vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}

function Btn({ children, color = '#27d84a', onClick, disabled, className = '' }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rbx-btn rbx-text rbx-text-thin studs px-4 py-2 text-[1.8rem] ${className}`}
      style={{ background: color }}
    >
      {children}
    </button>
  )
}

function Card({ children, className = '', style }) {
  return (
    <div
      className={`rounded-[1.1rem] border-[0.3rem] border-[#151515] bg-[#f2f4f8] p-3 shadow-[inset_0_-0.3rem_0_rgba(0,0,0,0.12)] ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}

function Reward({ r }) {
  return (
    <span className="rbx-text rbx-text-thin text-[2rem]">
      {r.wins ? `🏆 ${fmt(r.wins)}` : `⚡ ${fmt(r.speed)}`}
    </span>
  )
}

/* ------------------------------------------------------------------------ */
/* Panels                                                                    */
/* ------------------------------------------------------------------------ */

function Bar({ pct, text, from, to }) {
  return (
    <div className="relative h-[3.2rem] w-full overflow-hidden rounded-full border-[0.3rem] border-[#151515] bg-[#dfe6f0]">
      <div className="h-full" style={{ width: `${Math.min(1, pct) * 100}%`, background: `linear-gradient(180deg, ${from}, ${to})` }} />
      <div className="rbx-text absolute inset-0 flex items-center justify-center text-[1.7rem]">{text}</div>
    </div>
  )
}

function RebirthPanel({ close }) {
  const level = useGameStore((s) => s.level)
  const rebirths = useGameStore((s) => s.rebirths)
  const rebirth = useGameStore((s) => s.rebirth)
  const ready = level >= REBIRTH_LEVEL
  const stat = (label, now, next) => (
    <Card className="flex flex-1 flex-col items-center gap-1">
      <div className="rbx-text rbx-text-thin text-[1.4rem]">{label}</div>
      <div className="flex items-center gap-2">
        <span className="rbx-text text-[2.2rem]">x{now}</span>
        <span className="rbx-text text-[1.8rem]">➜</span>
        <span className="rbx-text text-[2.4rem] text-[#3dff5a]">x{next}</span>
      </div>
    </Card>
  )
  return (
    <Modal title="Rebirth" icon="🔄" color="#2fc8ff" onClose={close} width="52rem">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rbx-text text-[2.4rem]">Rebirths: {rebirths}</div>
        <div className="flex w-full gap-4">
          {stat('Speed points gain', rebirthMultiplier(rebirths), rebirthMultiplier(rebirths + 1))}
          {stat('Wins gain', rebirthWinsMultiplier(rebirths), rebirthWinsMultiplier(rebirths + 1))}
        </div>
        <div className="rbx-text w-full text-left text-[1.6rem]">Requirement</div>
        <Bar pct={level / REBIRTH_LEVEL} text={`Level ${level} / ${REBIRTH_LEVEL}`} from="#ff7ae0" to="#c42ad8" />
        <Card className="w-full text-left">
          <div className="rbx-text rbx-text-thin text-[1.4rem] text-[#ff5a5a]">
            Resets: Level back to 1, run speed back to {runSpeedForLevel(1)}, Speed points
          </div>
          <div className="rbx-text rbx-text-thin text-[1.4rem] text-[#3dff5a]">Keeps: Wins, shinobi, trails, passes, stages</div>
          <div className="rbx-text rbx-text-thin text-[1.4rem] text-[#ffe23a]">
            Run speed grows with level: {runSpeedForLevel(1)} at Lv 1 up to {MAX_RUN_SPEED} at Lv {REBIRTH_LEVEL - 2}
          </div>
          <div className="rbx-text rbx-text-thin text-[1.4rem] text-[#6fe0ff]">Treadmills: 1 = x1.5, 3 = x2, 20 = x4 · World 2 needs 2</div>
        </Card>
        <Btn color="#ff4fd8" onClick={rebirth} disabled={!ready} className="px-10 text-[2.6rem]">
          REBIRTH
        </Btn>
      </div>
    </Modal>
  )
}

function TrailsPanel({ close }) {
  const wins = useGameStore((s) => s.wins)
  const trail = useGameStore((s) => s.trail)
  const trailsOwned = useGameStore((s) => s.trailsOwned)
  const owned = useGameStore((s) => s.owned)
  const buyTrail = useGameStore((s) => s.buyTrail)
  const equipTrail = useGameStore((s) => s.equipTrail)
  return (
    <Modal title="Trails" icon="🔥" color="#b43cff" onClose={close}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {TRAILS.map((t) => {
          const has = trailsOwned.includes(t.id) || (t.product && owned[t.product])
          const equipped = trail === t.id
          const swatch =
            t.color === 'rainbow'
              ? 'linear-gradient(90deg,#ff3040,#ffa21f,#ffe01f,#3fe04a,#2fa8ff,#a24bff)'
              : `linear-gradient(180deg, ${t.color}, ${t.color}aa)`
          return (
            <Card key={t.id} className="flex flex-col items-center gap-2 text-center">
              <div className="h-[4.5rem] w-full rounded-lg border-[0.25rem] border-[#151515]" style={{ background: swatch }} />
              <div className="rbx-text rbx-text-thin text-[1.6rem]">{t.name}</div>
              <div className="rbx-text rbx-text-thin text-[1.4rem] text-[#9dff9d]">
                {t.boost ? `+${Math.round(t.boost * 100)}% Speed points` : 'No bonus'}
              </div>
              {equipped ? (
                <Btn color="#9aa3b2" disabled>
                  Equipped
                </Btn>
              ) : has ? (
                <Btn color="#27b6ff" onClick={() => equipTrail(t.id)}>
                  Equip
                </Btn>
              ) : t.product ? (
                <Btn color={wins >= PRODUCTS[t.product].price ? '#27d84a' : '#9aa3b2'} onClick={() => purchase(t.product)}>
                  <WinsPrice price={fmt(PRODUCTS[t.product].price)} />
                </Btn>
              ) : (
                <Btn color={wins >= t.cost ? '#27d84a' : '#9aa3b2'} onClick={() => buyTrail(t.id)}>
                  <WinsPrice price={fmt(t.cost)} />
                </Btn>
              )}
            </Card>
          )
        })}
      </div>
    </Modal>
  )
}

const AURA_ICONS = { spark: '✨', petal: '🌸', flame: '🔥', bolt: '⚡', leaf: '🍃', feather: '🪶', aura: '🌟' }

/**
 * Auras for your own avatar, bought with wins. Characters bring their own aura, so
 * a bought one shows while you are your Bloxity avatar.
 */
function AurasPanel({ close }) {
  const wins = useGameStore((s) => s.wins)
  const aura = useGameStore((s) => s.aura)
  const aurasOwned = useGameStore((s) => s.aurasOwned)
  const equipped = useGameStore((s) => s.equipped)
  const buyAura = useGameStore((s) => s.buyAura)
  const equipAura = useGameStore((s) => s.equipAura)
  const equip = useGameStore((s) => s.equip)
  const character = CHARACTER_BY_ID[equipped]
  return (
    <Modal title="Auras" icon="✨" color="#ff9a1f" onClose={close} width="64rem">
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border-[0.25rem] border-[#151515] bg-[#1e2233] px-4 py-2">
        <div className="rbx-text rbx-text-thin text-[1.4rem] text-white">
          {character
            ? `${character.name} already has its own aura. Bought auras show on your own avatar.`
            : 'A glow around your avatar and glowing footprints - everyone in the lobby sees it!'}
        </div>
        {character && (
          <Btn color="#27b6ff" onClick={() => equip(BLOXITY_AVATAR)}>
            My Avatar
          </Btn>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {AURAS.map((a) => {
          const has = aurasOwned.includes(a.id)
          const on = aura === a.id
          const glow = a.color || '#9aa3b2'
          return (
            <Card key={a.id} className="flex flex-col items-center gap-2 text-center">
              <div
                className="aura-swatch relative flex h-[6.4rem] w-full items-center justify-center overflow-hidden rounded-lg border-[0.25rem] border-[#151515]"
                style={{
                  background: a.color ? `radial-gradient(circle at 50% 65%, ${glow} 0%, ${glow}88 30%, #10131c 72%)` : '#2a2f3d',
                  '--aura': glow,
                }}
              >
                <span className="text-[3rem] drop-shadow-[0_0.2rem_0_rgba(0,0,0,0.5)]">{a.fx ? AURA_ICONS[a.fx] : '⭕'}</span>
              </div>
              <div className="rbx-text rbx-text-thin text-[1.55rem]">{a.name}</div>
              {on ? (
                <Btn color="#9aa3b2" disabled>
                  Equipped
                </Btn>
              ) : has ? (
                <Btn color="#27b6ff" onClick={() => equipAura(a.id)}>
                  Equip
                </Btn>
              ) : (
                <Btn color={wins >= a.cost ? '#27d84a' : '#9aa3b2'} onClick={() => buyAura(a.id)}>
                  <WinsPrice price={fmt(a.cost)} />
                </Btn>
              )}
            </Card>
          )
        })}
      </div>
    </Modal>
  )
}

function DailyPanel({ close }) {
  // Re-read on every render; `daily` in the store drives this.
  useGameStore((s) => s.daily)
  const dailyState = useGameStore((s) => s.dailyState)
  const claimDaily = useGameStore((s) => s.claimDaily)
  const { canClaim, next } = dailyState()
  return (
    <Modal title="7 Day Rewards" icon="📅" color="#ff3b4a" onClose={close}>
      <div className="grid grid-cols-4 gap-4 sm:grid-cols-7">
        {DAILY_REWARDS.map((r, i) => {
          const claimed = i < next || (i === next - 1 && !canClaim)
          const today = i === next && canClaim
          return (
            <Card
              key={i}
              className="flex flex-col items-center gap-2 text-center"
              style={{ background: today ? '#fff6c4' : claimed ? '#d9ffd4' : undefined }}
            >
              <div className="rbx-text rbx-text-thin text-[1.5rem]">Day {i + 1}</div>
              <Reward r={r} />
              {today ? (
                <Btn onClick={claimDaily} className="text-[1.4rem]">
                  Claim
                </Btn>
              ) : (
                <div className="rbx-text rbx-text-thin text-[1.3rem]">{claimed ? '✅' : '🔒'}</div>
              )}
            </Card>
          )
        })}
      </div>
      {!canClaim && (
        <div className="rbx-text rbx-text-thin mt-4 text-center text-[1.6rem]">Come back tomorrow for your next reward!</div>
      )}
    </Modal>
  )
}

function WorldsPanel({ close }) {
  const rebirths = useGameStore((s) => s.rebirths)
  const world = useGameStore((s) => s.world)
  const goToWorld = useGameStore((s) => s.goToWorld)
  return (
    <Modal title="Worlds" icon="🌍" color="#2fa8ff" onClose={close} width="46rem">
      <div className="grid grid-cols-2 gap-5">
        {WORLDS.map((w) => {
          const unlocked = rebirths >= w.rebirths
          return (
            <Card key={w.id} className="flex flex-col items-center gap-2 text-center" style={{ background: `${w.color}33` }}>
              <div className="rbx-text text-[2.6rem]" style={{ color: w.color }}>
                {w.name}
              </div>
              <div className="rbx-text rbx-text-thin text-[1.6rem]">{w.sub}</div>
              <div className="rbx-text rbx-text-thin text-[1.4rem]">{w.rebirths ? `${w.rebirths} Rebirths required` : 'Free'}</div>
              {world === w.id ? (
                <Btn color="#9aa3b2" disabled>
                  You are here
                </Btn>
              ) : (
                <Btn color={unlocked ? '#27d84a' : '#9aa3b2'} onClick={() => goToWorld(w.id)}>
                  {unlocked ? 'Teleport' : `🔒 ${w.rebirths} Rebirths`}
                </Btn>
              )}
            </Card>
          )
        })}
      </div>
    </Modal>
  )
}

export function RevivePanel() {
  const wins = useGameStore((s) => s.wins)
  const revive = useGameStore((s) => s.revive)
  const [left, setLeft] = useState(15)
  useEffect(() => {
    const id = setInterval(() => setLeft((t) => t - 1), 1000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (left <= 0) revive('lobby')
  }, [left, revive])
  const canWins = wins >= REVIVE_WINS
  return (
    <Modal title="WANT TO REVIVE?" icon="😵" color="#27b6ff" width="56rem">
      <div className="flex flex-col items-center gap-5 py-4">
        <button
          type="button"
          disabled={!canWins}
          onClick={() => revive('wins')}
          className="rbx-btn rbx-text w-[30rem] py-4 text-[4rem]"
          style={{ background: canWins ? '#8a6a12' : '#4a3a0a', color: canWins ? '#fff' : '#9a8a6a' }}
        >
          {REVIVE_WINS} Wins
        </button>
        <button
          type="button"
          onClick={() => revive('lobby')}
          className="rbx-btn rbx-text w-[30rem] bg-linear-to-b from-[#ff5a5a] to-[#e0101a] py-4 text-[4rem]"
        >
          NO
        </button>
        <div className="rbx-text rbx-text-thin text-[1.6rem]">Back to the lobby in {Math.max(0, left)}s</div>
      </div>
    </Modal>
  )
}

const PANELS = {
  rebirth: RebirthPanel,
  trails: TrailsPanel,
  auras: AurasPanel,
  daily: DailyPanel,
  worlds: WorldsPanel,
}

export function Panels() {
  const panel = useGameStore((s) => s.panel)
  const reviveOpen = useGameStore((s) => s.reviveOpen)
  const closePanel = useGameStore((s) => s.closePanel)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closePanel])

  if (reviveOpen) return <RevivePanel />
  const Panel = PANELS[panel]
  return Panel ? <Panel close={closePanel} /> : null
}

export default Panels
