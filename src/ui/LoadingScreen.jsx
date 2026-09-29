import { useEffect, useState } from 'react'

import { useGameStore } from '../game/gameStore'

const TIPS = [
  'Every second you run gives Speed points.',
  'Level up to run faster: 10 at level 1, 25 at the top.',
  'Press Space again in the air for a front-flip double jump.',
  'E dashes across the big gaps.',
  'Step on the gold pad at the end of a stage to collect Wins.',
  'Reach level 25 to Rebirth for bigger gains.',
]

function Shuriken({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className}>
      <g fill="#2a2f3a" stroke="#0e1117" strokeWidth="3" strokeLinejoin="round">
        {[0, 90, 180, 270].map((a) => (
          <path key={a} d="M50 50 L58 40 L50 4 L42 40 Z" transform={`rotate(${a} 50 50)`} />
        ))}
      </g>
      <g fill="#8a93a6" opacity="0.8">
        {[0, 90, 180, 270].map((a) => (
          <path key={a} d="M50 46 L54 40 L50 12 Z" transform={`rotate(${a} 50 50)`} />
        ))}
      </g>
      <circle cx="50" cy="50" r="9" fill="#c8231c" stroke="#0e1117" strokeWidth="3" />
      <circle cx="50" cy="50" r="3.5" fill="#ffd8a0" />
    </svg>
  )
}

/** Full-screen ninja-themed loading screen, shown until the world is on screen. */
export function LoadingScreen() {
  const loaded = useGameStore((s) => s.loaded)
  const [gone, setGone] = useState(false)
  const [tip, setTip] = useState(0)
  const [pct, setPct] = useState(6)

  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 2600)
    return () => clearInterval(id)
  }, [])

  // Eases toward 90% while loading; jumps to 100% when the world is ready.
  useEffect(() => {
    if (loaded) return undefined
    const id = setInterval(() => setPct((p) => p + (90 - p) * 0.06), 120)
    return () => clearInterval(id)
  }, [loaded])

  useEffect(() => {
    if (!loaded) return undefined
    const id = setTimeout(() => setGone(true), 700)
    return () => clearTimeout(id)
  }, [loaded])

  if (gone) return null
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden transition-opacity duration-700"
      style={{
        opacity: loaded ? 0 : 1,
        background: 'radial-gradient(ellipse at 50% 38%, #ffb35a 0%, #f06a2a 38%, #7a1f1a 78%, #2a0c0e 100%)',
      }}
    >
      {/* Setting sun and drifting leaves behind the title. */}
      <div className="absolute left-1/2 top-[18%] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[#ffe3a0] opacity-40 blur-[0.4rem]" />
      {Array.from({ length: 14 }, (_, i) => (
        <span
          key={i}
          className="loading-leaf absolute top-[-5%] h-[1.4rem] w-[0.9rem] rounded-[60%_0] bg-[#3fae3a]"
          style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.53) % 4}s`, animationDuration: `${5 + (i % 4)}s` }}
        />
      ))}
      {/* Village rooftops silhouette along the bottom. */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[22%] bg-[#1c0a0c]"
        style={{
          clipPath:
            'polygon(0 55%,6% 55%,9% 35%,15% 35%,18% 55%,26% 55%,29% 20%,36% 20%,39% 55%,48% 55%,52% 30%,58% 30%,61% 55%,70% 55%,73% 25%,80% 25%,83% 55%,92% 55%,95% 40%,100% 40%,100% 100%,0 100%)',
        }}
      />

      <Shuriken className="loading-spin relative mb-4 h-[9rem] w-[9rem] drop-shadow-[0_0.4rem_0.4rem_rgba(0,0,0,0.45)]" />
      <div className="rbx-text relative text-center text-[6.4rem] leading-none text-[#ffe23a]">+1 SPEED</div>
      <div className="rbx-text relative mt-1 text-center text-[4.4rem] leading-none">SHINOBI ESCAPE</div>

      <div className="relative mt-10 h-[2.6rem] w-[44rem] max-w-[86vw] overflow-hidden rounded-full border-[0.35rem] border-[#151515] bg-[#2a0c0e]">
        <div
          className="h-full rounded-full bg-linear-to-r from-[#ffd23a] via-[#ff9a1f] to-[#ff5a1f] transition-[width] duration-300"
          style={{ width: `${loaded ? 100 : pct}%` }}
        />
      </div>
      <div className="rbx-text rbx-text-thin relative mt-3 text-[1.8rem]">{loaded ? 'Ready!' : 'Loading the ninja village...'}</div>
      <div className="relative mt-6 max-w-[80vw] rounded-xl bg-black/35 px-5 py-2 text-center text-[1.6rem] font-semibold text-[#ffe9c4]">
        Tip: {TIPS[tip]}
      </div>
    </div>
  )
}

export default LoadingScreen
