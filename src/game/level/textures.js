import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace } from 'three'

/**
 * Procedural canvas textures in the flat, bright Roblox style. Generated once and
 * cloned per mesh so each surface can have its own repeat.
 *
 * Textures are painted in greyscale-ish tones and multiplied by the material colour,
 * so the same "wood" works for the light bridge and the dark hall floor.
 */

const cache = new Map()

function rng(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function canvas(size = 128) {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return [c, c.getContext('2d')]
}

const PAINTERS = {
  sand(g, n) {
    const r = rng(7)
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, n, n)
    for (let i = 0; i < 900; i++) {
      const v = 225 + Math.floor(r() * 30)
      g.fillStyle = `rgb(${v},${v},${v - 10})`
      g.fillRect(r() * n, r() * n, 2, 2)
    }
  },
  grass(g, n) {
    const r = rng(3)
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, n, n)
    for (let i = 0; i < 500; i++) {
      const v = 215 + Math.floor(r() * 40)
      g.fillStyle = `rgb(${v},${v},${v})`
      g.fillRect(r() * n, r() * n, 3, 3)
    }
  },
  wood(g, n) {
    const r = rng(11)
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, n, n)
    const planks = 6
    for (let i = 0; i < planks; i++) {
      const y = (i * n) / planks
      const v = 205 + Math.floor(r() * 45)
      g.fillStyle = `rgb(${v},${v},${v})`
      g.fillRect(0, y, n, n / planks)
      g.fillStyle = 'rgba(60,30,10,0.35)'
      g.fillRect(0, y, n, 2)
      for (let k = 0; k < 5; k++) {
        g.fillStyle = 'rgba(80,40,10,0.12)'
        g.fillRect(0, y + 3 + r() * (n / planks - 6), n, 1)
      }
    }
  },
  stone(g, n) {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, n, n)
    const rows = 4
    const h = n / rows
    for (let row = 0; row < rows; row++) {
      const off = row % 2 ? n / 4 : 0
      g.fillStyle = 'rgba(0,0,0,0.22)'
      g.fillRect(0, row * h, n, 3)
      for (let x = off; x < n + n / 2; x += n / 2) g.fillRect(x % n, row * h, 3, h)
      g.fillStyle = 'rgba(255,255,255,0.12)'
      g.fillRect(0, row * h + 3, n, 3)
    }
  },
  tiles(g, n) {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, n, n)
    g.fillStyle = 'rgba(255,200,0,0.9)'
    g.fillRect(0, 0, n, 4)
    g.fillRect(0, 0, 4, n)
    g.fillStyle = 'rgba(0,0,0,0.06)'
    g.fillRect(8, 8, n - 16, n - 16)
  },
  hall(g, n) {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, n, n)
    g.fillStyle = 'rgba(0,0,0,0.12)'
    for (let x = 0; x < n; x += n / 4) g.fillRect(x, 0, 3, n)
    g.fillStyle = 'rgba(255,255,255,0.25)'
    g.fillRect(0, n * 0.46, n, n * 0.08)
  },
  panel(g, n) {
    // Dark diamond lattice of the wall-run walls.
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, n, n)
    g.strokeStyle = 'rgba(120,150,210,0.35)'
    g.lineWidth = 2
    for (let i = -n; i < n * 2; i += n / 6) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i + n, n)
      g.stroke()
      g.beginPath()
      g.moveTo(i + n, 0)
      g.lineTo(i, n)
      g.stroke()
    }
  },
  lattice(g, n) {
    g.clearRect(0, 0, n, n)
    g.strokeStyle = '#ffffff'
    g.lineWidth = 7
    for (let i = -n; i < n * 2; i += n / 3) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i + n, n)
      g.stroke()
      g.beginPath()
      g.moveTo(i + n, 0)
      g.lineTo(i, n)
      g.stroke()
    }
    g.lineWidth = 10
    g.strokeRect(0, 0, n, n)
  },
  building(g, n) {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, n, n)
    // Two rows of blue windows with white frames.
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const x = 16 + col * 58
        const y = 14 + row * 60
        g.fillStyle = '#f4f4f4'
        g.fillRect(x - 3, y - 3, 44, 40)
        g.fillStyle = '#7fb4d8'
        g.fillRect(x, y, 38, 34)
        g.fillStyle = '#f4f4f4'
        g.fillRect(x + 18, y, 3, 34)
        g.fillRect(x, y + 16, 38, 3)
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.08)'
    g.fillRect(0, n - 6, n, 6)
  },
  water(g, n) {
    g.fillStyle = '#35d0ff'
    g.fillRect(0, 0, n, n)
    g.strokeStyle = 'rgba(255,255,255,0.75)'
    g.lineWidth = 3
    for (let y = 8; y < n; y += 22) {
      for (let x = (y / 22) % 2 ? 0 : 16; x < n + 32; x += 32) {
        g.beginPath()
        g.arc(x, y, 12, Math.PI * 0.15, Math.PI * 0.85)
        g.stroke()
      }
    }
  },
  glow(g, n) {
    const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.55)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.clearRect(0, 0, n, n)
    g.fillStyle = grad
    g.fillRect(0, 0, n, n)
  },
  chevron(g, n) {
    // Arrows pointing along +u (the treadmill's running direction).
    g.clearRect(0, 0, n, n)
    g.strokeStyle = '#ffffff'
    g.lineWidth = n * 0.12
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.beginPath()
    g.moveTo(n * 0.3, n * 0.2)
    g.lineTo(n * 0.62, n * 0.5)
    g.lineTo(n * 0.3, n * 0.8)
    g.stroke()
  },
  templeWall(g, n) {
    // Cream plaster with a red wooden frame, a lattice window and the leaf crest.
    g.fillStyle = '#f3e6c8'
    g.fillRect(0, 0, n, n)
    g.fillStyle = '#c8231c'
    g.fillRect(0, 0, n, 8)
    g.fillRect(0, n - 10, n, 10)
    g.fillRect(0, 0, 8, n)
    g.fillRect(n - 8, 0, 8, n)
    g.fillStyle = '#3a2a2a'
    g.fillRect(n * 0.3, n * 0.2, n * 0.4, n * 0.28)
    g.strokeStyle = '#c8231c'
    g.lineWidth = 3
    for (let i = 1; i < 4; i++) {
      g.beginPath()
      g.moveTo(n * 0.3 + (i * n * 0.4) / 4, n * 0.2)
      g.lineTo(n * 0.3 + (i * n * 0.4) / 4, n * 0.48)
      g.stroke()
    }
    g.beginPath()
    g.moveTo(n * 0.3, n * 0.34)
    g.lineTo(n * 0.7, n * 0.34)
    g.stroke()
    // Konoha leaf swirl
    g.strokeStyle = '#c8231c'
    g.lineWidth = 4
    g.beginPath()
    g.arc(n * 0.5, n * 0.7, n * 0.1, 0.3, Math.PI * 1.9)
    g.stroke()
    g.beginPath()
    g.arc(n * 0.5, n * 0.7, n * 0.04, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.moveTo(n * 0.6, n * 0.72)
    g.lineTo(n * 0.68, n * 0.84)
    g.stroke()
  },
  roof(g, n) {
    // Rows of curved roof tiles.
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, n, n)
    for (let x = 0; x < n; x += n / 8) {
      g.fillStyle = 'rgba(0,0,0,0.22)'
      g.fillRect(x, 0, 3, n)
      g.fillStyle = 'rgba(255,255,255,0.35)'
      g.fillRect(x + 5, 0, 3, n)
    }
    g.fillStyle = 'rgba(0,0,0,0.18)'
    for (let y = 0; y < n; y += n / 4) g.fillRect(0, y, n, 3)
  },
  towerBands(g, n) {
    // Konoha's round white towers: bands of dark window slots.
    g.fillStyle = '#f4f2ec'
    g.fillRect(0, 0, n, n)
    for (let y = n * 0.12; y < n; y += n / 4) {
      g.fillStyle = '#3a3d44'
      g.fillRect(0, y, n, n * 0.1)
      g.fillStyle = '#f4f2ec'
      for (let x = 0; x < n; x += n / 6) g.fillRect(x, y, 3, n * 0.1)
    }
    g.fillStyle = 'rgba(0,0,0,0.06)'
    g.fillRect(0, n - 4, n, 4)
  },
  fence(g, n) {
    g.fillStyle = '#9a6a3e'
    g.fillRect(0, 0, n, n)
    for (let x = 0; x < n; x += n / 6) {
      g.fillStyle = 'rgba(0,0,0,0.28)'
      g.fillRect(x, 0, 3, n)
      g.fillStyle = 'rgba(255,255,255,0.12)'
      g.fillRect(x + 4, 0, 2, n)
    }
    g.fillStyle = 'rgba(60,30,10,0.35)'
    g.fillRect(0, n * 0.2, n, 5)
    g.fillRect(0, n * 0.75, n, 5)
  },
  banner(g, n) {
    // Red cloth banner with 木ノ葉 ("Hidden Leaf") in white.
    g.fillStyle = '#c8231c'
    g.fillRect(0, 0, n, n)
    g.fillStyle = '#8a1410'
    g.fillRect(0, 0, n, 8)
    g.fillRect(0, n - 8, n, 8)
    g.fillStyle = '#ffffff'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `bold ${n * 0.26}px "Yu Gothic", "Meiryo", "MS Gothic", sans-serif`
    ;['木', 'ノ', '葉'].forEach((c, i) => g.fillText(c, n / 2, n * (0.2 + i * 0.3)))
  },
  bannerYellow(g, n) {
    g.fillStyle = '#f2c230'
    g.fillRect(0, 0, n, n)
    g.fillStyle = '#c8231c'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `bold ${n * 0.3}px "Yu Gothic", "Meiryo", "MS Gothic", sans-serif`
    ;['忍', '者'].forEach((c, i) => g.fillText(c, n / 2, n * (0.28 + i * 0.44)))
  },
  fireSign(g, n) {
    // The 火 (fire) emblem on the Hokage building.
    g.clearRect(0, 0, n, n)
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.arc(n / 2, n / 2, n * 0.48, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#c8231c'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `bold ${n * 0.62}px "Yu Gothic", "Meiryo", "MS Gothic", sans-serif`
    g.fillText('火', n / 2, n * 0.54)
  },
  lava(g, n) {
    const r = rng(9)
    g.fillStyle = '#ff5a0a'
    g.fillRect(0, 0, n, n)
    for (let i = 0; i < 26; i++) {
      const x = r() * n
      const y = r() * n
      const rad = 6 + r() * 16
      const grad = g.createRadialGradient(x, y, 0, x, y, rad)
      grad.addColorStop(0, 'rgba(255,230,90,0.95)')
      grad.addColorStop(1, 'rgba(255,120,20,0)')
      g.fillStyle = grad
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }
    g.strokeStyle = 'rgba(120,20,0,0.55)'
    g.lineWidth = 3
    for (let i = 0; i < 10; i++) {
      g.beginPath()
      g.moveTo(r() * n, r() * n)
      g.lineTo(r() * n, r() * n)
      g.stroke()
    }
  },
  wallrunPanel(g, n) {
    // Navy studded panel with a white running-ninja mark and an "up" circle, like
    // the original's wall-run walls. One tile = one mark.
    g.fillStyle = '#1f2b46'
    g.fillRect(0, 0, n, n)
    g.strokeStyle = 'rgba(120,150,210,0.28)'
    g.lineWidth = 2
    for (let i = -n; i < n * 2; i += n / 10) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i + n, n)
      g.stroke()
      g.beginPath()
      g.moveTo(i + n, 0)
      g.lineTo(i, n)
      g.stroke()
    }
    // Running figure
    g.fillStyle = 'rgba(255,255,255,0.9)'
    const cx = n * 0.3
    const cy = n * 0.45
    g.beginPath()
    g.arc(cx + 6, cy - 30, 9, 0, Math.PI * 2)
    g.fill()
    g.save()
    g.translate(cx, cy)
    g.rotate(0.35)
    g.fillRect(-7, -20, 14, 30)
    g.restore()
    g.lineWidth = 7
    g.lineCap = 'round'
    g.strokeStyle = 'rgba(255,255,255,0.9)'
    for (const [x1, y1, x2, y2] of [
      [cx, cy + 8, cx - 16, cy + 30],
      [cx + 4, cy + 8, cx + 22, cy + 24],
      [cx + 2, cy - 14, cx - 20, cy - 4],
      [cx + 4, cy - 14, cx + 22, cy - 22],
    ]) {
      g.beginPath()
      g.moveTo(x1, y1)
      g.lineTo(x2, y2)
      g.stroke()
    }
    // Up arrow in a circle
    const ax = n * 0.75
    const ay = n * 0.5
    g.lineWidth = 4
    g.strokeStyle = 'rgba(160,190,240,0.6)'
    g.beginPath()
    g.ellipse(ax, ay, 16, 26, 0, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = 'rgba(160,190,240,0.6)'
    g.beginPath()
    g.moveTo(ax, ay - 16)
    g.lineTo(ax - 9, ay - 2)
    g.lineTo(ax + 9, ay - 2)
    g.fill()
    g.fillRect(ax - 3, ay - 3, 6, 16)
  },
  falls(g, n) {
    // Waterfall: blue with bright vertical streaks (scrolled downward).
    g.fillStyle = '#3aa8e8'
    g.fillRect(0, 0, n, n)
    const r = rng(5)
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.5})`
      g.fillRect(r() * n, r() * n, 2 + r() * 4, 20 + r() * 50)
    }
  },
  belt(g, n) {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, n, n)
    g.fillStyle = 'rgba(0,0,0,0.25)'
    for (let x = 0; x < n; x += n / 8) g.fillRect(x, 0, 6, n)
  },
}

/** Returns a texture for `key`, repeated `rx` x `ry` times. */
export function getTexture(key, rx = 1, ry = 1) {
  const painter = PAINTERS[key]
  if (!painter) return null
  let base = cache.get(key)
  if (!base) {
    const size = { banner: 256, bannerYellow: 256, fireSign: 256 }[key] ?? 128
    const [c, g] = canvas(size)
    painter(g, size)
    base = new CanvasTexture(c)
    base.colorSpace = SRGBColorSpace
    base.wrapS = RepeatWrapping
    base.wrapT = RepeatWrapping
    base.anisotropy = 4
    if (key === 'lattice') base.magFilter = NearestFilter
    cache.set(key, base)
  }
  const tex = base.clone()
  tex.repeat.set(Math.max(1, rx), Math.max(1, ry))
  tex.needsUpdate = true
  return tex
}
