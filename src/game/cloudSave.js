/**
 * Account saves on the game server, so progress follows the player's Bloxity
 * account to any browser or day. The server identifies the player from the token.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

/** @returns {Promise<{ data: object|null, updatedAt: number }>} */
export async function loadCloudSave(token) {
  const res = await fetch(`${API_URL}/api/save`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`load save ${res.status}`)
  return res.json()
}

/** `keepalive` lets the last save still go out while the tab is closing. */
export async function storeCloudSave(token, data, keepalive = false) {
  const res = await fetch(`${API_URL}/api/save`, {
    method: 'POST',
    keepalive,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  })
  if (!res.ok) throw new Error(`store save ${res.status}`)
}
