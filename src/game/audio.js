/**
 * All game audio, synthesized with WebAudio so the game ships no sound files:
 *   - short tone effects (jump, win, ...)
 *   - noise effects (footsteps, landing thud, crashes)
 *   - a wind loop whose volume follows the run speed
 *   - a calm looping ninja-garden tune: shakuhachi-style flute, koto, a warm pad,
 *     wind chimes and water drops, all through a soft echo
 *
 * Browsers only allow audio after a user gesture, so everything starts lazily and
 * `unlockAudio()` is called on the first key press / click.
 */

let ctx = null
let master = null
let sfxBus = null
let musicBus = null
let noiseBuffer = null
let sfxOn = true
let musicOn = true
/** Background music sits well under the sound effects; everything is kept soft. */
const MUSIC_VOLUME = 0.09

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.55
    master.connect(ctx.destination)
    sfxBus = ctx.createGain()
    sfxBus.connect(master)
    musicBus = ctx.createGain()
    musicBus.gain.value = musicOn ? MUSIC_VOLUME : 0
    musicBus.connect(master)
    // A soft, darkened echo after the music volume, so muting lets the tail fade out.
    const echo = ctx.createDelay(2)
    echo.delayTime.value = 0.64
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 2200
    const feedback = ctx.createGain()
    feedback.gain.value = 0.34
    const wet = ctx.createGain()
    wet.gain.value = 0.4
    musicBus.connect(echo)
    echo.connect(tone).connect(feedback).connect(echo)
    tone.connect(wet).connect(master)
    // One second of white noise, reused by every noise effect.
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

export function setSfxEnabled(value) {
  sfxOn = Boolean(value)
  if (!sfxOn) setWind(0)
}

export function setMusicEnabled(value) {
  musicOn = Boolean(value)
  if (musicBus && ctx) musicBus.gain.setTargetAtTime(musicOn ? MUSIC_VOLUME : 0, ctx.currentTime, 0.3)
  if (musicOn) startMusic()
}

/** Call from a user gesture: creates the context and starts the music. */
export function unlockAudio() {
  if (!audio()) return
  startMusic()
}

/* ------------------------------------------------------------------------ */
/* Tone effects                                                              */
/* ------------------------------------------------------------------------ */

const EFFECTS = {
  click: [[660, 0, 0.05, 'square']],
  jump: [[420, 0, 0.08, 'triangle'], [620, 0.04, 0.08, 'triangle']],
  dash: [[180, 0, 0.18, 'sawtooth'], [90, 0.05, 0.2, 'sawtooth']],
  win: [[523, 0, 0.12, 'square'], [659, 0.1, 0.12, 'square'], [784, 0.2, 0.12, 'square'], [1046, 0.3, 0.25, 'square']],
  coins: [
    [1318, 0, 0.08, 'square'],
    [1568, 0.07, 0.08, 'square'],
    [1318, 0.18, 0.08, 'square'],
    [1760, 0.25, 0.12, 'square'],
    [2093, 0.36, 0.25, 'triangle'],
  ],
  level: [[784, 0, 0.1, 'triangle'], [988, 0.08, 0.1, 'triangle'], [1318, 0.16, 0.2, 'triangle']],
  buy: [[880, 0, 0.08, 'square'], [1320, 0.07, 0.15, 'square']],
  equip: [[587, 0, 0.08, 'triangle'], [880, 0.06, 0.12, 'triangle']],
  error: [[200, 0, 0.12, 'square'], [150, 0.1, 0.15, 'square']],
  death: [[400, 0, 0.15, 'sawtooth'], [250, 0.12, 0.2, 'sawtooth'], [120, 0.28, 0.35, 'sawtooth']],
  rebirth: [
    [392, 0, 0.1, 'square'],
    [523, 0.1, 0.1, 'square'],
    [659, 0.2, 0.1, 'square'],
    [784, 0.3, 0.1, 'square'],
    [1046, 0.4, 0.5, 'triangle'],
  ],
  portal: [[300, 0, 0.3, 'sine'], [600, 0.1, 0.3, 'sine']],
  wall: [[240, 0, 0.06, 'triangle']],
  warn: [[880, 0, 0.06, 'square'], [880, 0.12, 0.06, 'square']],
  locked: [[330, 0, 0.09, 'triangle'], [247, 0.08, 0.22, 'triangle']],
  flash: [[1200, 0, 0.06, 'triangle'], [1800, 0.04, 0.14, 'triangle'], [2400, 0.1, 0.18, 'sine']],
}

/** Noise effects: [filter Hz, duration s, volume, filter type]. */
const NOISES = {
  step: [900, 0.05, 0.05, 'bandpass'],
  land: [260, 0.14, 0.16, 'lowpass'],
  crash: [180, 0.6, 0.35, 'lowpass'],
  whoosh: [1400, 0.3, 0.12, 'bandpass'],
}

export function sfx(name, volume = 0.08) {
  if (!sfxOn) return
  const ac = audio()
  if (!ac) return
  const now = ac.currentTime

  const noise = NOISES[name]
  if (noise) {
    const [freq, dur, vol, type] = noise
    const src = ac.createBufferSource()
    src.buffer = noiseBuffer
    src.playbackRate.value = 0.8 + Math.random() * 0.4
    const filter = ac.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq * (0.85 + Math.random() * 0.3)
    const gain = ac.createGain()
    gain.gain.setValueAtTime(vol, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    src.connect(filter).connect(gain).connect(sfxBus)
    src.start(now, Math.random() * 0.5, dur + 0.05)
    return
  }

  const tones = EFFECTS[name]
  if (!tones) return
  for (const [freq, start, dur, type] of tones) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now + start)
    gain.gain.setValueAtTime(0.0001, now + start)
    gain.gain.exponentialRampToValueAtTime(volume, now + start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)
    osc.connect(gain).connect(sfxBus)
    osc.start(now + start)
    osc.stop(now + start + dur + 0.02)
  }
}

/* ------------------------------------------------------------------------ */
/* Wind                                                                      */
/* ------------------------------------------------------------------------ */

let windGain = null
let windFilter = null

/** 0..1: the rushing-air loop that grows with run speed. */
export function setWind(amount) {
  if (!ctx) return
  if (!windGain) {
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    src.loop = true
    windFilter = ctx.createBiquadFilter()
    windFilter.type = 'bandpass'
    windFilter.Q.value = 0.7
    windGain = ctx.createGain()
    windGain.gain.value = 0
    src.connect(windFilter).connect(windGain).connect(sfxBus)
    src.start()
  }
  const a = sfxOn ? Math.max(0, Math.min(1, amount)) : 0
  windGain.gain.setTargetAtTime(a * a * 0.09, ctx.currentTime, 0.15)
  windFilter.frequency.setTargetAtTime(400 + a * 1400, ctx.currentTime, 0.15)
}

/* ------------------------------------------------------------------------ */
/* Music                                                                     */
/* ------------------------------------------------------------------------ */

// Calm "yo" scale on D (D E G A B): open and peaceful, a quiet shrine garden.
const SCALE = [146.83, 164.81, 196.0, 220.0, 246.94, 293.66, 329.63, 392.0, 440.0, 493.88, 587.33, 659.25]
// Eighth notes at a slow 68 BPM; the loop is 64 steps (about half a minute).
const STEP = 60 / 68 / 2
const LOOP = 64
// Koto: sparse rolling arpeggios (-1 = rest).
const KOTO = [
  0, -1, 4, -1, 7, -1, -1, -1, 5, -1, -1, -1, 4, -1, -1, -1,
  2, -1, 5, -1, 8, -1, -1, -1, 7, -1, 5, -1, -1, -1, -1, -1,
  3, -1, 5, -1, 9, -1, -1, -1, 8, -1, -1, -1, 7, -1, -1, -1,
  0, -1, 4, -1, 7, -1, 9, -1, 10, -1, -1, -1, -1, -1, -1, -1,
]
// Pad chords every 16 steps: [root, fifth] as scale indexes.
const PAD = [[0, 3], [2, 5], [3, 7], [0, 3]]
// Flute phrases: step -> [scale index, length in steps]. Long breaths with space around.
const FLUTE = {
  4: [8, 6],
  12: [7, 3],
  16: [5, 10],
  36: [9, 4],
  40: [8, 3],
  44: [7, 10],
  56: [6, 4],
  60: [5, 4],
}

let musicTimer = null
let nextTime = 0
let step = 0

function pluck(freq, t, vol, dur = 2.2) {
  // Koto: bright attack, long gentle decay, a quiet octave shimmer.
  for (const [mult, type, v] of [
    [1, 'triangle', 1],
    [2.003, 'sine', 0.22],
  ]) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq * mult, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol * v, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g).connect(musicBus)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }
}

/** A warm drone that swells in and out under a whole bar. */
function pad(freqs, t, dur) {
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 650
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.05, t + dur * 0.35)
  g.gain.linearRampToValueAtTime(0.0001, t + dur)
  filter.connect(g).connect(musicBus)
  for (const f of freqs) {
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = f / 2
      osc.detune.value = detune
      osc.connect(filter)
      osc.start(t)
      osc.stop(t + dur + 0.05)
    }
  }
}

/**
 * Shakuhachi-style flute: slides up into the note, a slow vibrato that grows, and
 * a band of breath noise on the attack.
 */
function flute(freq, t, dur, vol) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  const vib = ctx.createOscillator()
  const vibGain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq * 0.94, t)
  osc.frequency.exponentialRampToValueAtTime(freq, t + 0.22)
  vib.frequency.setValueAtTime(4.6, t)
  vibGain.gain.setValueAtTime(0, t)
  vibGain.gain.linearRampToValueAtTime(freq * 0.014, t + dur * 0.6)
  vib.connect(vibGain).connect(osc.frequency)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.3)
  g.gain.setValueAtTime(vol, t + dur * 0.6)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(musicBus)
  osc.start(t)
  vib.start(t)
  osc.stop(t + dur + 0.05)
  vib.stop(t + dur + 0.05)

  const breath = ctx.createBufferSource()
  breath.buffer = noiseBuffer
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = freq * 2
  band.Q.value = 5
  const bg = ctx.createGain()
  bg.gain.setValueAtTime(0.0001, t)
  bg.gain.exponentialRampToValueAtTime(vol * 0.45, t + 0.1)
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
  breath.connect(band).connect(bg).connect(musicBus)
  breath.start(t, Math.random() * 0.2)
  breath.stop(t + 0.75)
}

/** A wind chime: a pure tone with a slightly out-of-tune overtone, ringing long. */
function chime(freq, t) {
  for (const [mult, v] of [
    [1, 1],
    [2.76, 0.3],
  ]) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq * mult
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.022 * v, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2)
    osc.connect(g).connect(musicBus)
    osc.start(t)
    osc.stop(t + 3.3)
  }
}

/** A water drop into a still pond. */
function drop(t) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(700, t)
  osc.frequency.exponentialRampToValueAtTime(1500, t + 0.09)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.03, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
  osc.connect(g).connect(musicBus)
  osc.start(t)
  osc.stop(t + 0.2)
}

/** A soft, deep hand drum marking each bar. */
function drum(t) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(95, t)
  osc.frequency.exponentialRampToValueAtTime(52, t + 0.3)
  g.gain.setValueAtTime(0.12, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
  osc.connect(g).connect(musicBus)
  osc.start(t)
  osc.stop(t + 0.75)
}

function schedule() {
  while (nextTime < ctx.currentTime + 0.3) {
    const i = step % LOOP
    const k = KOTO[i]
    if (k >= 0) pluck(SCALE[k], nextTime, 0.05)
    if (i % 16 === 0) {
      pad(PAD[i / 16].map((n) => SCALE[n]), nextTime, STEP * 17)
      drum(nextTime)
    }
    const f = FLUTE[i]
    if (f) flute(SCALE[f[0]] * 2, nextTime, f[1] * STEP, 0.07)
    if (i % 4 === 2 && Math.random() < 0.3) chime(SCALE[7 + Math.floor(Math.random() * 5)] * 2, nextTime)
    if (i % 8 === 5 && Math.random() < 0.25) drop(nextTime)
    nextTime += STEP
    step += 1
  }
}

function startMusic() {
  if (!musicOn || musicTimer || !audio()) return
  nextTime = ctx.currentTime + 0.1
  musicTimer = setInterval(schedule, 100)
}
