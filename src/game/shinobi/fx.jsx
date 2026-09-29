import { Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending } from 'three'

/**
 * Jutsu held in a shinobi's hand while posing on a lobby pedestal. The bright
 * emissive colours are what the bloom pass picks up.
 */

/** Spinning energy orb. */
export function EnergyOrb({ color = '#4fc3ff', size = 0.24 }) {
  const rings = useRef(null)
  const shell = useRef(null)
  useFrame(({ clock }, dt) => {
    if (rings.current) {
      rings.current.rotation.y += dt * 9
      rings.current.rotation.x += dt * 4
    }
    if (shell.current) shell.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 14) * 0.06)
  })
  return (
    <group>
      <mesh>
        <sphereGeometry args={[size * 0.55, 16, 12]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh ref={shell}>
        <sphereGeometry args={[size, 18, 14]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.6}
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </mesh>
      <group ref={rings}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[i * 1.05, i * 0.7, 0]}>
            <torusGeometry args={[size * 1.08, size * 0.07, 6, 24]} />
            <meshBasicMaterial color="#e8f8ff" transparent opacity={0.8} blending={AdditiveBlending} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <Sparkles count={10} scale={size * 4} size={3} speed={3} color={color} />
    </group>
  )
}

const BOLTS = 7

/** Crackling lightning (Kakashi / Sasuke). Bolts re-randomise every few frames. */
export function Lightning({ color = '#9fdcff' }) {
  const bolts = useRef([])
  const tick = useRef(0)
  useFrame((_s, dt) => {
    tick.current += dt
    if (tick.current < 0.06) return
    tick.current = 0
    bolts.current.forEach((m) => {
      if (!m) return
      m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
      m.scale.set(1, 0.4 + Math.random() * 0.9, 1)
    })
  })
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.22, 14, 10]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {Array.from({ length: BOLTS }, (_, i) => (
        <mesh key={i} ref={(m) => (bolts.current[i] = m)}>
          <boxGeometry args={[0.025, 0.55, 0.025]} />
          <meshBasicMaterial color="#e8f6ff" toneMapped={false} />
        </mesh>
      ))}
      <Sparkles count={12} scale={0.8} size={3} speed={4} color="#ffffff" />
    </group>
  )
}

export function HandFx({ type, color }) {
  if (type === 'orb') return <EnergyOrb color={color} />
  if (type === 'spark') return <Lightning color={color} />
  return null
}
