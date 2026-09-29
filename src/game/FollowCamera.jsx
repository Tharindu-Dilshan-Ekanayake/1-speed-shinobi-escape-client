import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { getGame } from './gameStore'
import { runtime } from './runtime'
import useKeyboard from './useKeyboard'

/** How high above the player's origin the camera aims. */
const LOOK_HEIGHT = 1.4

const MIN_DISTANCE = 4
const MAX_DISTANCE = 30
const START_DISTANCE = 8

// Pitch limits, in radians. Stops the camera flipping over the top or sinking
// under the track.
const MIN_PITCH = -0.2
const MAX_PITCH = 1.3
const START_PITCH = 0.26

const DRAG_SENSITIVITY = 0.005
const ZOOM_SENSITIVITY = 0.01

/** Higher = the look target catches up faster. */
const FOLLOW_RATE = 22

/** A / D camera turn speed, radians per second. */
const TURN_RATE = 2.3

const BASE_FOV = 70
/** Extra field of view at top speed: the anime "rush" feel. */
const SPEED_FOV = 14

const _target = new Vector3()

/**
 * Roblox-style third-person orbit camera.
 *
 * Right-click drag (or a one-finger drag on touch screens) orbits, the mouse wheel
 * zooms. The camera eases its look target toward the player and then sits at a fixed
 * orbit offset from it, so it never lags far behind even at extreme speeds.
 *
 * `runtime.cameraYaw` snaps the orbit behind the player after a teleport.
 *
 * @param {{ bodyRef: React.MutableRefObject<any> }} props
 */
export function FollowCamera({ bodyRef }) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const keys = useKeyboard()
  const turnVel = useRef(0)

  // Spherical offset from the player. A ref, not state: pointer events write to it
  // every mousemove and the frame loop reads it - re-rendering would be wasteful.
  const orbit = useRef({ yaw: 0, pitch: START_PITCH, distance: START_DISTANCE })
  const lookAt = useRef(new Vector3())
  const initialised = useRef(false)

  // Exposed so the dev tools (and a future settings slider) can adjust the orbit.
  useEffect(() => {
    runtime.orbit = orbit.current
  }, [])

  useEffect(() => {
    const el = gl.domElement
    if (!el) return

    let dragging = false
    let lastX = 0
    let lastY = 0

    const onPointerDown = (e) => {
      if (e.button !== 2 && e.pointerType !== 'touch') return
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      el.setPointerCapture?.(e.pointerId)
    }

    const onPointerMove = (e) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY

      const o = orbit.current
      o.yaw -= dx * DRAG_SENSITIVITY
      o.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, o.pitch + dy * DRAG_SENSITIVITY))
    }

    const endDrag = (e) => {
      if (!dragging) return
      dragging = false
      el.releasePointerCapture?.(e.pointerId)
    }

    const onWheel = (e) => {
      // Without this the page scrolls behind the canvas.
      e.preventDefault()
      const o = orbit.current
      o.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, o.distance + e.deltaY * ZOOM_SENSITIVITY))
    }

    // Right-dragging otherwise opens the browser context menu mid-orbit.
    const onContextMenu = (e) => e.preventDefault()

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('pointercancel', endDrag)
    el.addEventListener('contextmenu', onContextMenu)
    // passive:false is required for preventDefault() on wheel to take effect.
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endDrag)
      el.removeEventListener('pointercancel', endDrag)
      el.removeEventListener('contextmenu', onContextMenu)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame((state, delta) => {
    const body = bodyRef.current
    if (!body) return

    // A / D (and the arrow keys) swing the camera around; W then runs that way.
    const dtc = Math.min(delta, 0.1)
    if (getGame().settings.adCamera) {
      const k = keys.current
      const want = ((k.left ? 1 : 0) - (k.right ? 1 : 0)) * TURN_RATE
      turnVel.current += (want - turnVel.current) * (1 - Math.exp(-dtc * 10))
      orbit.current.yaw += turnVel.current * dtc
    }

    // Widen the lens as the player speeds up.
    const fov = BASE_FOV + SPEED_FOV * Math.min(1, Math.max(0, (runtime.speedRatio - 0.3) / 0.7))
    const cam = state.camera
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * (1 - Math.exp(-dtc * 4))
      cam.updateProjectionMatrix()
    }

    if (runtime.cameraYaw !== null) {
      orbit.current.yaw = runtime.cameraYaw
      runtime.cameraYaw = null
      initialised.current = false
    }

    const pos = body.translation()
    _target.set(pos.x, pos.y + LOOK_HEIGHT, pos.z)

    if (!initialised.current) {
      // Avoid a long swoop in from wherever the camera was (spawn, teleports).
      lookAt.current.copy(_target)
      initialised.current = true
    }
    lookAt.current.lerp(_target, 1 - Math.exp(-Math.min(delta, 0.05) * FOLLOW_RATE))

    // Spherical -> cartesian. yaw 0 puts the camera behind the player on +Z.
    const { yaw, pitch, distance } = orbit.current
    const horizontal = Math.cos(pitch) * distance
    camera.position.set(
      lookAt.current.x + Math.sin(yaw) * horizontal,
      lookAt.current.y + Math.sin(pitch) * distance,
      lookAt.current.z + Math.cos(yaw) * horizontal,
    )
    camera.lookAt(lookAt.current)
  })

  return null
}

export default FollowCamera
