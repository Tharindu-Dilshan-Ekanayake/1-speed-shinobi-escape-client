/**
 * Talks to the game server's leaderboard endpoints (see the server repo).
 * Fails soft: with no server running the boards just show the local player.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export async function fetchLeaderboard() {
  const res = await fetch(`${API_URL}/api/leaderboard`)
  if (!res.ok) throw new Error(`leaderboard ${res.status}`)
  return res.json()
}

export async function submitScore(entry) {
  await fetch(`${API_URL}/api/leaderboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  })
}

/** A stable id for this browser when the player is not signed in. */
export function localPlayerId() {
  const KEY = 'shinobi-escape-player-id'
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = `guest_${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return 'guest_local'
  }
}
