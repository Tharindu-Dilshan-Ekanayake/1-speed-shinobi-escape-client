import { RoundedBox, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

import { useBake } from './bake'
import { HandFx } from './fx'
import { LOOKS } from './looks'
import { Ball, mat, R } from './prims'

/**
 * A blocky R6-style shinobi. Feet at y = 0, total height ~1.87, facing +Z.
 *
 * Pass `motionRef` (the player's motion state) to animate running, the iconic
 * arms-back ninja run at high speed, jumping and wall running. Without it the
 * model idles; with `posed` (lobby pedestals) it holds its signature pose instead,
 * jutsu and all.
 */

const clamp01 = (v) => Math.min(1, Math.max(0, v))

function Arm({ look, side, fx }) {
  const o = { glow: look.glow }
  return (
    <>
      <R p={[0, -0.3, 0]} s={[0.355, 0.72, 0.355]} c={look.sleeve} {...o} />
      {look.forearm !== look.sleeve && <R p={[0, -0.43, 0]} s={[0.362, 0.33, 0.362]} c={look.forearm} {...o} />}
      <R p={[0, -0.6, 0]} s={[0.366, 0.13, 0.366]} c={look.hand} radius={0.05} {...o} />
      {look.arm?.(side)}
      {fx && (
        <group position={[0, -0.9, 0.05]} userData={{ bakeBoundary: true }}>
          <HandFx type={fx.type} color={fx.color} />
        </group>
      )}
    </>
  )
}

function Leg({ look, side }) {
  const o = { glow: look.glow }
  return (
    <>
      <R p={[0, -0.36, 0]} s={[0.355, 0.72, 0.355]} c={look.pants} {...o} />
      {look.shins !== look.pants && <R p={[0, -0.52, 0]} s={[0.362, 0.36, 0.362]} c={look.shins} {...o} />}
      <R p={[0, -0.665, 0.015]} s={[0.37, 0.11, 0.39]} c={look.shoe} radius={0.04} {...o} />
      {look.leg?.(side)}
    </>
  )
}

/** Resting pose for a free-standing (not posed) shinobi. */
const REST = { aL: [0, 0.06], aR: [0, -0.06], lL: [0, 0], lR: [0, 0], lean: 0, head: 0 }

export function ShinobiModel({ id = 'kaito', motionRef, phase = 0, onReady, posed = false, poseOverride }) {
  const look = LOOKS[id] || LOOKS.kaito
  const basePose = poseOverride ?? look.pose
  const pose = posed && basePose ? { ...REST, ...basePose } : null

  const torso = useRef(null)
  const head = useRef(null)
  const armL = useRef(null)
  const armR = useRef(null)
  const legL = useRef(null)
  const legR = useRef(null)
  const idleTime = useRef(phase)

  useEffect(() => {
    onReady?.()
  }, [onReady])

  // Merge each body part into a few meshes (see bake.js). Re-bakes on a new look.
  useBake(legL, id)
  useBake(legR, id)
  useBake(torso, id)
  useBake(head, id)
  useBake(armL, id)
  useBake(armR, id)

  useFrame((_state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05)
    let m = motionRef?.current
    if (!m) {
      idleTime.current += dt
      m = { time: idleTime.current, speed: 0, grounded: true, maxSpeed: 10 }
    }
    const ratio = clamp01(m.speed / Math.max(m.maxSpeed, 0.001))
    const t = m.time

    // Target pose: [x, z] per limb.
    let aL, aR
    let { lL, lR, lean, head: headX } = REST

    if (m.flying) {
      aL = [0, 0.5]
      aR = [0, -0.5]
      lL = [-0.2, 0]
      lR = [0.2, 0]
    } else if (!m.grounded && !m.wallrun) {
      // Jump / fall: arms thrown up, one knee tucked.
      aL = [-2.5, 0.3]
      aR = [-2.3, -0.3]
      lL = [-0.7, 0]
      lR = [0.35, 0]
      lean = 0.1
    } else if (ratio > 0.04 || m.wallrun) {
      const r = m.wallrun ? 1 : ratio
      const cycle = Math.sin(t * (6 + r * 9))
      const stride = 1.0 * Math.max(r, 0.4)
      lL = [cycle * stride, 0]
      lR = [-cycle * stride, 0]
      if (m.wallrun) {
        const reach = [0.25, 1.45 * m.wallrun]
        const back = [1.35, -0.28 * m.wallrun]
        aL = m.wallrun > 0 ? reach : [back[0], -back[1]]
        aR = m.wallrun > 0 ? [back[0], back[1]] : [reach[0], reach[1]]
        lean = 0.35
        headX = -0.2
      } else if (r > 0.45 || m.dashing) {
        // The ninja run: arms swept straight back, body leaning into it.
        aL = [1.35, 0.28]
        aR = [1.35, -0.28]
        lean = 0.5 * r
        headX = -0.35 * r
      } else {
        aL = [-cycle * 0.9 * r, 0.06]
        aR = [cycle * 0.9 * r, -0.06]
        lean = 0.12 * r
      }
    } else if (pose) {
      const breathe = Math.sin(t * 1.8) * 0.03
      aL = [pose.aL[0] - breathe, pose.aL[1] + breathe]
      aR = [pose.aR[0] - breathe, pose.aR[1] - breathe]
      lL = pose.lL
      lR = pose.lR
      lean = pose.lean + breathe * 0.5
      headX = pose.head
    } else {
      const breathe = Math.sin(t * 1.8)
      aL = [0, 0.07 + breathe * 0.03]
      aR = [0, -0.07 - breathe * 0.03]
      headX = breathe * 0.02
    }

    const k = 1 - Math.exp(-dt * 16)
    const ease = (obj, axis, target) => {
      obj.rotation[axis] += (target - obj.rotation[axis]) * k
    }
    if (armL.current) {
      ease(armL.current, 'x', aL[0])
      ease(armL.current, 'z', aL[1])
      ease(armR.current, 'x', aR[0])
      ease(armR.current, 'z', aR[1])
      ease(legL.current, 'x', lL[0])
      ease(legL.current, 'z', lL[1])
      ease(legR.current, 'x', lR[0])
      ease(legR.current, 'z', lR[1])
      ease(torso.current, 'x', lean)
      ease(head.current, 'x', headX)
    }
  })

  const skin = mat(look.skin, { glow: look.glow, rough: 0.55 })
  const fx = pose?.fx

  return (
    <group>
      <group ref={legL} position={[0.18, 0.72, 0]} userData={{ bakeBoundary: true }}>
        <Leg look={look} side={1} />
      </group>
      <group ref={legR} position={[-0.18, 0.72, 0]} userData={{ bakeBoundary: true }}>
        <Leg look={look} side={-1} />
      </group>
      <group ref={torso} position={[0, 0.72, 0]} userData={{ bakeBoundary: true }}>
        <R p={[0, 0.36, 0]} s={[0.72, 0.72, 0.36]} c={look.shirt} glow={look.glow} radius={0.06} />
        {look.torso?.()}
        <group ref={head} position={[0, 0.72, 0]} userData={{ bakeBoundary: true }}>
          <RoundedBox args={[0.42, 0.42, 0.42]} radius={0.09} smoothness={4} position={[0, 0.22, 0]} material={skin} castShadow />
          {look.head?.()}
        </group>
        <group ref={armL} position={[0.54, 0.66, 0]} userData={{ bakeBoundary: true }}>
          <Arm look={look} side={1} fx={fx?.side === 1 ? fx : null} />
        </group>
        <group ref={armR} position={[-0.54, 0.66, 0]} userData={{ bakeBoundary: true }}>
          <Arm look={look} side={-1} fx={fx?.side === -1 ? fx : null} />
        </group>
      </group>
      {look.aura && (
        <>
          <Sparkles count={26} scale={[1.6, 2.4, 1.6]} position={[0, 1.1, 0]} size={4} speed={0.6} color={look.aura} />
          <Ball p={[0, 1, 0]} s={[0.95, 1.25, 0.95]} c={look.aura} glow={1} opacity={0.12} add />
        </>
      )}
    </group>
  )
}

export default ShinobiModel
