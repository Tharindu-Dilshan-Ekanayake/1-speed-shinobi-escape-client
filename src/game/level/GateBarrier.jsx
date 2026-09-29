import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, DoubleSide, ShaderMaterial } from 'three'

import { useGameStore } from '../gameStore'

/**
 * The glowing sheet across a stage gate. Once you have the stage's level it is a
 * soft shimmer you run straight through; below it, a red hex force field with a
 * padlock that won't let you pass (the player loop does the blocking). Reaching the
 * level makes the lock spring open and the field fade back to the gate's colour.
 */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uLock;
  uniform vec3 uColor;
  uniform vec2 uSize;
  varying vec2 vUv;

  // Distance to the edge of the hexagon cell containing p.
  float hexEdge(vec2 p) {
    vec2 r = vec2(1.0, 1.732);
    vec2 h = r * 0.5;
    vec2 a = mod(p, r) - h;
    vec2 b = mod(p - h, r) - h;
    vec2 g = dot(a, a) < dot(b, b) ? a : b;
    g = abs(g);
    return 0.5 - max(dot(g, normalize(r)), g.x);
  }

  void main() {
    vec2 world = vUv * uSize;
    vec3 red = vec3(1.0, 0.16, 0.2);
    vec3 col = mix(uColor, red, uLock);
    // Open: a soft sheet with bright bands drifting up.
    float shimmer = 0.5 + 0.5 * sin(world.y * 1.3 - uTime * 2.2 + sin(world.x * 0.35 + uTime) * 1.5);
    float open = 0.16 + shimmer * 0.12;
    // Locked: hex cells, a scan line sweeping down and a pulsing glow.
    float edge = 1.0 - smoothstep(0.0, 0.06, hexEdge(world / 1.1));
    float scan = exp(-pow(fract(vUv.y + uTime * 0.35) - 0.5, 2.0) * 180.0);
    float pulse = 0.75 + 0.25 * sin(uTime * 4.0);
    float locked = 0.2 + edge * 0.55 * pulse + scan * 0.35;
    // Frame glow along the sides and the ground.
    float border = max(1.0 - smoothstep(0.0, 0.04, min(vUv.x, 1.0 - vUv.x)), 1.0 - smoothstep(0.0, 0.05, vUv.y));
    float a = mix(open, locked, uLock) + border * (0.25 + uLock * 0.45);
    a *= 1.0 - smoothstep(0.85, 1.0, vUv.y) * 0.6;
    gl_FragColor = vec4(mix(col, vec3(1.0), edge * uLock * 0.25 + border * 0.3), clamp(a, 0.0, 0.85));
  }
`

const LOCK_BODY = '#ff3848'

export function GateBarrier({ p, w, h, color, req }) {
  const locked = useGameStore((s) => s.level < req)
  const sheet = useRef(null)
  const lock = useRef(null)
  const shackle = useRef(null)
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uLock: { value: locked ? 1 : 0 },
          uColor: { value: new Color(color) },
          uSize: { value: [w, h] },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      }),
    // `locked` only sets the starting state; later changes animate in useFrame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [color, w, h],
  )

  useFrame(({ clock }, dt) => {
    const u = sheet.current?.material.uniforms
    if (!u) return
    u.uTime.value = clock.elapsedTime
    const target = locked ? 1 : 0
    u.uLock.value += (target - u.uLock.value) * (1 - Math.exp(-Math.min(dt, 0.1) * 3))
    const k = u.uLock.value
    const g = lock.current
    if (!g) return
    // The padlock bobs while locked; on unlocking the shackle springs up and it all
    // shrinks away.
    g.visible = k > 0.02
    g.position.y = 2.7 + Math.sin(clock.elapsedTime * 2) * 0.12
    g.rotation.y = Math.sin(clock.elapsedTime * 0.9) * 0.35
    g.scale.setScalar(Math.min(1, k * 1.4))
    if (shackle.current) shackle.current.position.y = 0.55 + (1 - k) * 0.9
  })

  return (
    <group position={p}>
      <mesh ref={sheet} position={[0, h / 2, 0]} material={material} renderOrder={2}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <group ref={lock} position={[0, 2.7, 0.4]}>
        <mesh>
          <boxGeometry args={[1.5, 1.25, 0.5]} />
          <meshStandardMaterial color={LOCK_BODY} emissive={LOCK_BODY} emissiveIntensity={0.7} metalness={0.4} roughness={0.35} />
        </mesh>
        <mesh ref={shackle} position={[0, 0.55, 0]}>
          <torusGeometry args={[0.46, 0.13, 10, 20, Math.PI]} />
          <meshStandardMaterial color="#e8ecf2" metalness={0.8} roughness={0.25} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[0, 0, side * 0.26]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.02, 14]} />
            <meshBasicMaterial color="#2a0508" />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <mesh key={`k${side}`} position={[0, -0.2, side * 0.26]}>
            <boxGeometry args={[0.09, 0.32, 0.02]} />
            <meshBasicMaterial color="#2a0508" />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export default GateBarrier
