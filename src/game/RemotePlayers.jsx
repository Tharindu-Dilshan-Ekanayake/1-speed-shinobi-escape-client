import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import { AdditiveBlending } from 'three'

import { BodyAura } from './Aura'
import { emitPrint } from './auraPrints'
import { auraFor, BLOXITY_AVATAR } from './config'
import { Label } from './level/Label'
import { peerMotion, samplePeer, useNet } from './net'
import { PLAYER_HEIGHT } from './Player'
import PlayerAvatar from './PlayerAvatar'
import ShinobiModel from './shinobi/ShinobiModel'

/**
 * Other players in the lobby, exactly as they look to themselves: their Bloxity
 * avatar or the character they picked, with its aura and glowing footprints.
 */
export function RemotePlayers() {
  const peers = useNet((s) => s.peers)
  return Object.values(peers).map((p) => (
    <Suspense key={p.id} fallback={null}>
      <RemotePlayer peer={p} />
    </Suspense>
  ))
}

/** Distance between two footprints of the same player. */
const STRIDE = 0.85

function RemotePlayer({ peer }) {
  const group = useRef(null)
  const motion = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: 24, wallrun: 0 })
  const walk = useRef({ x: 0, z: 0, dist: 0, side: 1, ready: false })
  const aura = useMemo(() => auraFor(peer.char, peer.aura), [peer.char, peer.aura])

  useFrame((_s, rawDt) => {
    const g = group.current
    const m = peerMotion.get(peer.id)
    if (!g) return
    const ok = Boolean(m) && samplePeer(m)
    g.visible = ok
    if (!ok) return
    const dt = Math.min(rawDt, 0.1)
    g.position.set(m.pos[0], m.pos[1] - PLAYER_HEIGHT / 2, m.pos[2])
    let d = m.yaw - g.rotation.y
    d = Math.atan2(Math.sin(d), Math.cos(d))
    g.rotation.y += d * (1 - Math.exp(-dt * 16))
    const mo = motion.current
    mo.time += dt
    mo.speed = m.spd
    mo.grounded = Boolean(m.gr)
    mo.wallrun = m.wr

    // Footprints every stride while they run on the ground.
    const w = walk.current
    const moved = Math.hypot(m.pos[0] - w.x, m.pos[2] - w.z)
    w.x = m.pos[0]
    w.z = m.pos[2]
    if (!w.ready || moved > 5) {
      w.ready = true
      w.dist = 0
      return
    }
    if (aura && m.gr && m.spd > 2 && !m.wr) {
      w.dist += moved
      if (w.dist >= STRIDE) {
        w.dist -= STRIDE
        w.side = -w.side
        emitPrint(m.pos[0], m.pos[1] - PLAYER_HEIGHT / 2, m.pos[2], m.yaw, w.side, aura.color)
      }
    }
  })

  const onAvatar = !peer.char || peer.char === BLOXITY_AVATAR
  return (
    <group ref={group} visible={false}>
      {onAvatar ? (
        <PlayerAvatar remote equipped={peer.avatar} targetHeight={PLAYER_HEIGHT} motionRef={motion} />
      ) : (
        <group scale={PLAYER_HEIGHT / 1.87}>
          <ShinobiModel id={peer.char} motionRef={motion} />
        </group>
      )}
      {aura ? (
        <BodyAura aura={aura} motionRef={motion} />
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.7, 0.95, 32]} />
          <meshBasicMaterial color={peer.color} transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <Billboard position={[0, PLAYER_HEIGHT + 0.55, 0]}>
        <Label text={peer.name} p={[0, 0, 0]} size={0.42} color={peer.color} outline="#101010" />
      </Billboard>
    </group>
  )
}

export default RemotePlayers
