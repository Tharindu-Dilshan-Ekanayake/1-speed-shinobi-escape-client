import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three'

import { fmt } from '../format'
import { FONT_URL } from './Label'

/**
 * The leaderboard screens are drawn on a 2D canvas and shown as one texture, so the
 * names and numbers stay sharp and readable from across the lobby (3D text went
 * thin and blurry at that distance) and cost a single draw call.
 */

export const BOARD_W = 1024
export const BOARD_H = 912
const ROWS = 10
const FONT = 'LilitaBoard'

let fontReady = null
/** Loads the game's chunky font for canvas use; resolves either way. */
export function loadBoardFont() {
  if (!fontReady) {
    fontReady =
      typeof FontFace === 'undefined'
        ? Promise.resolve()
        : new FontFace(FONT, `url(${FONT_URL})`)
            .load()
            .then((face) => document.fonts.add(face))
            .catch(() => {})
  }
  return fontReady
}

export function makeBoardTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = BOARD_W
  canvas.height = BOARD_H
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  tex.minFilter = LinearMipmapLinearFilter
  return tex
}

const MEDALS = [
  ['#fff27a', '#ffc21f', '#b07800'],
  ['#ffffff', '#c9d2de', '#7d8796'],
  ['#ffc58a', '#e0913a', '#8a4a12'],
]

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Outlined text, the chunky Roblox look. */
function text(ctx, str, x, y, size, fill, align = 'left', outline = '#0a0c14') {
  ctx.font = `${size}px ${FONT}, 'Lilita One', 'Arial Black', sans-serif`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(4, size * 0.16)
  ctx.strokeStyle = outline
  ctx.strokeText(str, x, y)
  ctx.fillStyle = fill
  ctx.fillText(str, x, y)
}

/** Fits a name into `maxW` pixels, trimming with an ellipsis. */
function fitName(ctx, name, maxW) {
  let s = String(name)
  if (ctx.measureText(s).width <= maxW) return s
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1)
  return `${s}…`
}

/**
 * Draws one board. `rows`: [{ id, name, value }] best first; `me`: the local
 * player's id (their row is highlighted).
 */
export function drawBoard(tex, { rows, kind, accent, me }) {
  const canvas = tex.image
  const ctx = canvas.getContext('2d')
  const W = BOARD_W
  const H = BOARD_H
  const wins = kind === 'wins'

  // Night-blue screen with a soft vignette of the accent colour.
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#141a2e')
  bg.addColorStop(1, '#0b0e1a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 0, 40, W / 2, 0, W * 0.8)
  glow.addColorStop(0, `${accent}55`)
  glow.addColorStop(1, `${accent}00`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  // Faint diagonal stripes, like a shoji screen.
  ctx.strokeStyle = 'rgba(255,255,255,0.035)'
  ctx.lineWidth = 14
  for (let x = -H; x < W; x += 56) {
    ctx.beginPath()
    ctx.moveTo(x, H)
    ctx.lineTo(x + H, 0)
    ctx.stroke()
  }

  // Header row.
  const top = 70
  text(ctx, 'RANK', 70, top - 30, 30, '#8a93ad', 'center')
  text(ctx, 'PLAYER', 150, top - 30, 30, '#8a93ad')
  text(ctx, wins ? 'WINS' : 'SPEED', W - 50, top - 30, 30, '#8a93ad', 'right')

  const rowH = 74
  const gap = 4
  for (let i = 0; i < ROWS; i++) {
    const row = rows[i]
    const y = top + i * (rowH + gap)
    const medal = MEDALS[i]
    const mine = row && me && row.id === me
    // Row plate.
    roundRect(ctx, 16, y, W - 32, rowH, 16)
    if (medal && row) {
      const g = ctx.createLinearGradient(0, y, W, y)
      g.addColorStop(0, `${medal[1]}66`)
      g.addColorStop(0.6, `${medal[1]}22`)
      g.addColorStop(1, `${medal[1]}11`)
      ctx.fillStyle = g
    } else {
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.09)'
    }
    ctx.fill()
    if (mine) {
      ctx.lineWidth = 6
      ctx.strokeStyle = '#5fe08a'
      ctx.stroke()
    }
    const cy = y + rowH / 2
    // Rank: a shiny medal for the top three.
    if (medal) {
      const mg = ctx.createLinearGradient(0, cy - 30, 0, cy + 30)
      mg.addColorStop(0, medal[0])
      mg.addColorStop(1, medal[1])
      ctx.beginPath()
      ctx.arc(70, cy, 28, 0, Math.PI * 2)
      ctx.fillStyle = mg
      ctx.fill()
      ctx.lineWidth = 5
      ctx.strokeStyle = medal[2]
      ctx.stroke()
      text(ctx, `${i + 1}`, 70, cy + 2, 38, '#ffffff', 'center', medal[2])
    } else {
      text(ctx, `${i + 1}`, 70, cy + 2, 38, '#c9d0e0', 'center')
    }
    if (!row) {
      text(ctx, '---', 150, cy + 2, 36, 'rgba(255,255,255,0.25)', 'left', 'rgba(0,0,0,0)')
      continue
    }
    // Name, with a YOU tag on your own row.
    ctx.font = `44px ${FONT}, 'Lilita One', sans-serif`
    const tag = mine ? 110 : 0
    const name = fitName(ctx, row.name, 480 - tag)
    text(ctx, name, 150, cy + 2, 44, medal ? '#ffffff' : '#eef2ff')
    if (mine) {
      const nw = ctx.measureText(name).width
      roundRect(ctx, 150 + nw + 18, cy - 20, 84, 40, 12)
      ctx.fillStyle = '#27d84a'
      ctx.fill()
      text(ctx, 'YOU', 150 + nw + 60, cy + 2, 28, '#ffffff', 'center')
    }
    text(ctx, fmt(row.value), W - 50, cy + 2, 48, medal ? medal[0] : accent, 'right')
  }

  // Footer.
  const fy = top + ROWS * (rowH + gap) + 30
  text(ctx, rows.length ? 'All lobbies · updates live' : 'Loading…', W / 2, fy, 30, '#8a93ad', 'center')
  tex.needsUpdate = true
}
