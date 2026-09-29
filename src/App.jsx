import { useEffect } from 'react'

import { useBloxity } from './bloxity/BloxityContext'
import { setMusicEnabled, setSfxEnabled, unlockAudio } from './game/audio'
import { applyDevParams } from './game/devParams'
import GameScene from './game/GameScene'
import { getGame, useGameStore } from './game/gameStore'
import { loadCloudSave, storeCloudSave } from './game/cloudSave'
import { fetchLeaderboard, localPlayerId, submitScore } from './game/leaderboardApi'
import { connectLobby, sendLook } from './game/net'
import AuthHUD from './ui/AuthHUD'
import Hud from './ui/Hud'
import LoadingScreen from './ui/LoadingScreen'
import Panels from './ui/Panels'

const LEADERBOARD_SYNC_MS = 15000
const CLOUD_SAVE_MS = 15000

/**
 * Keeps a signed-in player's progress on their account: loads it on login (the
 * account wins over this browser), then saves every 15 s and when the tab hides.
 * Nothing is uploaded until the account's save has been read, so a fresh browser
 * can never overwrite real progress.
 */
function useAccountSave() {
  const { user, getToken } = useBloxity()

  useEffect(() => {
    if (!user) return undefined
    let ready = false
    let stopped = false
    const push = (keepalive = false) => {
      const token = getToken()
      if (!ready || !token) return
      storeCloudSave(token, getGame().exportSave(), keepalive).catch(() => {})
    }

    const token = getToken()
    if (!token) {
      console.warn('[save] no Bloxity token available; progress stays in this browser only')
      return undefined
    }
    loadCloudSave(token)
      .then((save) => {
        if (stopped) return
        if (save?.data) {
          getGame().applySave(save.data)
          getGame().toast('Progress loaded from your account', 'good')
        }
        ready = true
        if (!save?.data) push()
      })
      .catch(() => {
        // Server down: keep playing locally; don't upload over a save we couldn't read.
      })

    const timer = setInterval(() => push(), CLOUD_SAVE_MS)
    const onHide = () => {
      if (document.visibilityState === 'hidden') push(true)
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      push(true)
      stopped = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
    }
  }, [user, getToken])
}

/** Joins a multiplayer lobby and keeps the others told how this player looks. */
function useLobby() {
  const { identity, avatar, isReady } = useBloxity()
  const equipped = useGameStore((s) => s.equipped)
  const aura = useGameStore((s) => s.aura)
  const name = identity?.displayName || identity?.username || 'Player'

  useEffect(() => {
    if (isReady) connectLobby({ name, avatar })
  }, [isReady, name, avatar])

  useEffect(() => {
    sendLook({ name, avatar })
  }, [name, avatar, equipped, aura])
}

/** The once-a-second game tick, sound setting and leaderboard sync. */
function useGameLoop() {
  const { identity } = useBloxity()
  const sfxOn = useGameStore((s) => s.settings.sfx)
  const musicOn = useGameStore((s) => s.settings.music)

  useEffect(() => {
    applyDevParams()
    const id = setInterval(() => getGame().tick(), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => setSfxEnabled(sfxOn), [sfxOn])
  useEffect(() => setMusicEnabled(musicOn), [musicOn])

  // Browsers only start audio after a user gesture.
  useEffect(() => {
    const unlock = () => {
      unlockAudio()
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('pointerdown', unlock)
    }
    window.addEventListener('keydown', unlock)
    window.addEventListener('pointerdown', unlock)
    return () => {
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('pointerdown', unlock)
    }
  }, [])

  useEffect(() => {
    let stopped = false
    const id = identity?._id || identity?.id || localPlayerId()
    const name = identity?.displayName || identity?.username || 'You'

    const sync = async () => {
      const g = getGame()
      try {
        await submitScore({ id, name, wins: g.wins, speed: g.speed })
        const board = await fetchLeaderboard()
        if (!stopped) g.setLeaderboard({ ...board, me: id })
      } catch {
        // No server running: show just this player so the boards aren't empty.
        if (!stopped) {
          g.setLeaderboard({
            wins: [{ id, name, value: g.wins }],
            speed: [{ id, name, value: g.speed }],
            me: id,
          })
        }
      }
    }
    sync()
    const timer = setInterval(sync, LEADERBOARD_SYNC_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [identity])
}

function App() {
  useGameLoop()
  useAccountSave()
  useLobby()
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-sky-300">
      <GameScene />
      <Hud />
      <AuthHUD />
      <Panels />
      <LoadingScreen />
    </div>
  )
}

export default App
