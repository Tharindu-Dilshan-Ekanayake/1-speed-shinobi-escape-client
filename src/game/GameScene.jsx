import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BackSide, Color, ShaderMaterial } from 'three'

import { useBloxity } from '../bloxity/BloxityContext'
import { GRAVITY } from './config'
import FollowCamera from './FollowCamera'
import { useGameStore } from './gameStore'
import Level from './level/Level'
import { Clouds } from './level/Props'
import Player from './Player'
import RemotePlayers from './RemotePlayers'
import RunFx from './RunFx'
import { runtime } from './runtime'

/**
 * Fires `onFirstFrame` after the renderer has actually drawn once.
 * `loadingEnd()` should mean "the player can see the game", not "React mounted".
 */
function FirstFrameSignal({ onFirstFrame }) {
  const fired = useRef(false)
  useFrame(() => {
    if (fired.current) return
    fired.current = true
    onFirstFrame()
  })
  return null
}

/**
 * Roblox-style sky: a vertical gradient dome plus puffy clouds, re-centred on the
 * camera every frame so it never gets closer however far the player runs.
 */
function Sky() {
  const group = useRef(null)
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new Color('#2f8ff0') },
          horizon: { value: new Color('#d6ebfa') },
        },
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform vec3 top;
          uniform vec3 horizon;
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, 0.0, 1.0);
            gl_FragColor = vec4(mix(horizon, top, pow(h, 0.55)), 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useFrame(({ camera }) => {
    group.current?.position.set(camera.position.x, 0, camera.position.z)
  })
  return (
    <group ref={group}>
      <mesh material={material} renderOrder={-1}>
        <sphereGeometry args={[900, 24, 16]} />
      </mesh>
      <Clouds />
    </group>
  )
}

/** Sun whose shadow frustum follows the player, so shadows stay sharp everywhere. */
function Sun() {
  const light = useRef(null)
  const shadows = useGameStore((s) => s.settings.shadows)
  useFrame(() => {
    const l = light.current
    if (!l) return
    const [x, y, z] = runtime.position
    l.position.set(x + 35, y + 60, z + 25)
    l.target.position.set(x, y, z)
    l.target.updateMatrixWorld()
  })
  return (
    <directionalLight
      ref={light}
      castShadow={shadows}
      intensity={2.1}
      color="#ffe6c4"
      shadow-mapSize={[1536, 1536]}
      shadow-radius={2}
      shadow-camera-left={-45}
      shadow-camera-right={45}
      shadow-camera-top={45}
      shadow-camera-bottom={-45}
      shadow-camera-near={1}
      shadow-camera-far={160}
      shadow-bias={-0.0004}
    />
  )
}

/** Dev only: exposes the R3F state as window.__shinobi.three for console debugging. */
function DevHook() {
  const get = useThree((s) => s.get)
  useEffect(() => {
    if (import.meta.env.DEV && window.__shinobi) window.__shinobi.three = get
  }, [get])
  return null
}

export function GameScene() {
  const { game } = useBloxity()
  const playerBodyRef = useRef(null)

  const [avatarReady, setAvatarReady] = useState(false)
  const [dpr, setDpr] = useState(1.4)
  const loadingEnded = useRef(false)

  const handleAvatarReady = useCallback(() => setAvatarReady(true), [])

  // Only end the loading screen once the avatar has finished assembling *and* a
  // frame has rendered with it in place.
  const handleFirstFrame = useCallback(() => {
    if (loadingEnded.current || !avatarReady) return
    loadingEnded.current = true
    game.loadingEnd()
    useGameStore.setState({ loaded: true })
  }, [avatarReady, game])

  // The first frame usually renders before the avatar finishes downloading, so the
  // frame callback alone isn't enough — close the loading screen here too.
  useEffect(() => {
    if (!avatarReady || loadingEnded.current) return
    loadingEnded.current = true
    game.loadingEnd()
    useGameStore.setState({ loaded: true })
  }, [avatarReady, game])

  useEffect(() => {
    game.loadingStep('Building the Hidden Leaf…')
  }, [game])

  return (
    <Canvas
      shadows="percentage"
      flat
      camera={{ position: [0, 6, 34], fov: 70, near: 0.4, far: 1200 }}
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        // If the GPU drops the context, ask the browser to restore it in place
        // instead of leaving a black canvas.
        gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault())
      }}
    >
      {/* No tone mapping + bright fill light: the saturated, evenly lit Roblox look. */}
      <color attach="background" args={['#9fd8ff']} />
      <fog attach="fog" args={['#d6ebfa', 120, 500]} />
      {/* Softer fill than before: lit faces bright, shaded faces a clear step darker,
          for a cel-shaded anime look instead of everything washed out. */}
      <hemisphereLight args={['#dcecff', '#7a6a50', 0.85]} />
      <ambientLight intensity={0.28} />
      <Sun />
      <Sky />

      <Suspense fallback={null}>
        <Physics gravity={[0, -GRAVITY, 0]}>
          <Level />
          <Player bodyRef={playerBodyRef} onAvatarReady={handleAvatarReady} />
        </Physics>
        <RunFx />
        <RemotePlayers />
      </Suspense>

      <FollowCamera bodyRef={playerBodyRef} />
      <DevHook />
      {/* Drops the resolution a notch when the frame rate sags, raises it again when it recovers. */}
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.4)} flipflops={4} onFallback={() => setDpr(1)} />
      <FirstFrameSignal onFirstFrame={handleFirstFrame} />
    </Canvas>
  )
}

export default GameScene
