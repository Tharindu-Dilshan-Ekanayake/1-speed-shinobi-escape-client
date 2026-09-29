import { Client } from '@colyseus/sdk'
import { create } from 'zustand'

import { lookFor } from './config'
import { getGame } from './gameStore'
import { runtime } from './runtime'

/**
 * Multiplayer lobby over Colyseus. `joinOrCreate('lobby')` puts you in a lobby with
 * room (8 players max); the server opens a new lobby for the 9th. Each player runs
 * their own course; the lobby only shares where everyone is and how they look.
 * Fails soft: with no server the game plays exactly the same, just alone.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const WS_URL = import.meta.env.VITE_WS_URL || API_URL.replace(/^http/, 'ws')
/**
 * Hosted on Bloxity Legion, players enter through the matchmaker: it picks (or
 * boots) a server pod and hands back a relay for the socket. Locally there is no
 * matchmaker and the client talks to the dev server directly.
 */
const LEGION_GAME_ID = import.meta.env.VITE_LEGION_GAME_ID
const MATCHMAKER = import.meta.env.VITE_MATCHMAKER_URL || 'https://play.bloxity.io'

async function lobbyEndpoint() {
  if (!LEGION_GAME_ID) return WS_URL
  const res = await fetch(`${MATCHMAKER}/v1/play/${LEGION_GAME_ID}`, { method: 'POST' })
  if (!res.ok) throw new Error(`matchmaker ${res.status}`)
  const { roomId } = await res.json()
  return `${MATCHMAKER.replace(/^http/, 'ws')}/v1/ws/${roomId}`
}
const SEND_MS = 50
const RETRY_MS = 8000
/**
 * Other players are drawn this far in the past, between two snapshots they have
 * already sent, so they glide instead of stuttering when packets arrive unevenly.
 */
const INTERP_MS = 110
/** If snapshots stop coming, keep a runner moving along its last velocity this long. */
const MAX_EXTRAP_MS = 150
/** Snapshots kept per player. */
const BUFFER = 14

/** Who is in the lobby: id -> { id, name, char, color, avatar }. Re-renders on join/leave/look. */
export const useNet = create(() => ({ status: 'offline', roomId: null, peers: {} }))

/**
 * Per-frame motion of every other player, id -> { buf, pos, yaw, spd, gr, wr }.
 * `buf` holds timestamped snapshots (server clock); samplePeer() turns it into the
 * position to draw this frame. Not React state.
 */
export const peerMotion = new Map()

/** Server clock minus ours, from the fastest snapshot seen (drifts down slowly). */
let clockOffset = null
const serverNow = () => performance.now() + (clockOffset ?? 0)

function lerpAngle(a, b, k) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a))
  return a + d * k
}

const teleported = (a, b) => Math.abs(b.x - a.x) + Math.abs(b.y - a.y) + Math.abs(b.z - a.z) > 20

/**
 * Where to draw peer `m` right now: interpolated between the two snapshots around
 * (server time - INTERP_MS), or carried on a little past the newest one. Writes
 * m.pos / yaw / spd / gr / wr. Returns false until the first snapshot arrives.
 */
export function samplePeer(m) {
  const buf = m.buf
  if (!buf.length) return false
  const rt = serverNow() - INTERP_MS
  let i = buf.length - 1
  while (i > 0 && buf[i].t > rt) i--
  const a = buf[i]
  const b = buf[i + 1]
  if (a.t > rt) {
    // Older than everything we have (just joined): stand at the first snapshot.
    m.pos[0] = a.x
    m.pos[1] = a.y
    m.pos[2] = a.z
  } else if (b) {
    const k = teleported(a, b) ? 1 : (rt - a.t) / Math.max(1, b.t - a.t)
    m.pos[0] = a.x + (b.x - a.x) * k
    m.pos[1] = a.y + (b.y - a.y) * k
    m.pos[2] = a.z + (b.z - a.z) * k
    m.yaw = lerpAngle(a.yaw, b.yaw, k)
  } else {
    const prev = buf[i - 1]
    const ahead = Math.min(rt - a.t, MAX_EXTRAP_MS) / 1000
    const dt = prev ? (a.t - prev.t) / 1000 : 0
    const moving = prev && dt > 0 && !teleported(prev, a)
    m.pos[0] = a.x + (moving ? ((a.x - prev.x) / dt) * ahead : 0)
    m.pos[1] = a.y + (moving ? ((a.y - prev.y) / dt) * ahead : 0)
    m.pos[2] = a.z + (moving ? ((a.z - prev.z) / dt) * ahead : 0)
    m.yaw = a.yaw
  }
  const cur = b || a
  m.spd = cur.spd
  m.gr = cur.gr
  m.wr = cur.wr
  // Everything before the pair in use is spent.
  if (i > 1) buf.splice(0, i - 1)
  return true
}

let room = null
let busy = false
let sendTimer = null
let retryTimer = null
let lastOpts = null
let myId = null

function send() {
  if (!room) return
  const [x, y, z] = runtime.position
  room.send('move', {
    x,
    y,
    z,
    yaw: runtime.yaw,
    spd: runtime.dead ? 0 : runtime.animSpeed,
    gr: runtime.grounded ? 1 : 0,
    wr: runtime.wallSide,
  })
}

function lookMessage(opts) {
  const g = getGame()
  return { name: opts.name, char: g.equipped, aura: g.aura, color: lookFor(g.equipped).color, avatar: opts.avatar ?? null }
}

function setPeer(p) {
  if (!p || p.id === myId) return
  useNet.setState((s) => ({ peers: { ...s.peers, [p.id]: p } }))
}

function dropPeer(id) {
  peerMotion.delete(id)
  useNet.setState((s) => {
    const peers = { ...s.peers }
    delete peers[id]
    return { peers }
  })
}

function scheduleRetry() {
  clearTimeout(retryTimer)
  retryTimer = setTimeout(() => lastOpts && connectLobby(lastOpts), RETRY_MS)
}

/** Joins a lobby. `opts`: { name, avatar } (avatar = equipped Bloxity cosmetics). */
export async function connectLobby(opts) {
  lastOpts = opts
  if (room || busy) return
  busy = true
  useNet.setState({ status: 'connecting' })
  try {
    room = await new Client(await lobbyEndpoint()).joinOrCreate('lobby', lookMessage(opts))
  } catch (err) {
    console.warn('[net] could not join a lobby, retrying soon:', err?.message || err)
    room = null
    busy = false
    useNet.setState({ status: 'offline' })
    scheduleRetry()
    return
  }
  busy = false
  myId = room.sessionId
  // A new lobby may live on another server with its own clock.
  clockOffset = null

  room.onMessage('roster', ({ you, players }) => {
    myId = you
    const peers = {}
    for (const p of players) if (p.id !== you) peers[p.id] = p
    useNet.setState({ peers })
  })
  room.onMessage('join', setPeer)
  room.onMessage('look', setPeer)
  room.onMessage('leave', dropPeer)
  room.onMessage('snap', ({ t, p } = {}) => {
    if (!Array.isArray(p)) return
    const est = t - performance.now()
    clockOffset = clockOffset === null ? est : Math.max(est, clockOffset - 0.5)
    // Each row carries how long ago the server got that player's update, so every
    // snapshot is stamped with when the player was really there.
    for (const [id, x, y, z, yaw, spd, gr, wr, age] of p) {
      if (id === myId) continue
      let m = peerMotion.get(id)
      if (!m) {
        m = { buf: [], pos: [x, y, z], yaw, spd, gr, wr }
        peerMotion.set(id, m)
      }
      const at = t - age
      const last = m.buf[m.buf.length - 1]
      if (last && at <= last.t) continue
      m.buf.push({ t: at, x, y, z, yaw, spd, gr, wr })
      if (m.buf.length > BUFFER) m.buf.shift()
    }
  })
  room.onLeave(() => {
    clearInterval(sendTimer)
    room = null
    peerMotion.clear()
    useNet.setState({ status: 'offline', roomId: null, peers: {} })
    scheduleRetry()
  })

  sendTimer = setInterval(send, SEND_MS)
  useNet.setState({ status: 'online', roomId: room.roomId })
}

/** Tells the lobby about a new name, character or avatar. */
export function sendLook(opts) {
  lastOpts = opts
  room?.send('look', lookMessage(opts))
}
