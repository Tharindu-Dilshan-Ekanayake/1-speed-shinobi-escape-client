const SUFFIXES = ['', 'k', 'm', 'b', 't', 'qa', 'qi', 'sx', 'sp', 'oc', 'no', 'dc']

/** 1530 -> "1.5k", 2_000_000 -> "2m". Matches the Roblox game's HUD style. */
export function fmt(n) {
  if (!Number.isFinite(n)) return '0'
  const neg = n < 0
  let v = Math.abs(n)
  if (v < 1000) return (neg ? '-' : '') + String(Math.floor(v))
  let i = 0
  while (v >= 1000 && i < SUFFIXES.length - 1) {
    v /= 1000
    i += 1
  }
  const digits = v >= 100 ? 0 : 1
  const text = v.toFixed(digits).replace(/\.0$/, '')
  return (neg ? '-' : '') + text + SUFFIXES[i]
}

/** 125 -> "2:05" */
export function fmtTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return (h > 0 ? `${h}:` : '') + `${mm}:${String(r).padStart(2, '0')}`
}
