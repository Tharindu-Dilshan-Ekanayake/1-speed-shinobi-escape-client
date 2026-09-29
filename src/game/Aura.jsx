import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
} from 'three'

import { clock, PRINT_LIFE, PRINTS, printState } from './auraPrints'

/**
 * Auras: small glowing particles drifting up around the body, a gentle trickle
 * when standing and a steady stream while running. Plus glowing footprints that
 * stay on the ground for a few seconds. The particles move on the GPU, so a lobby
 * full of auras costs one draw call each and no per-frame CPU work.
 *
 * Used for the local player and for everyone else in the lobby alike.
 */

const STYLE_ID = { spark: 0, petal: 1, bolt: 2, leaf: 3, sand: 4, flame: 5, feather: 6, aura: 7 }
const _obj = new Object3D()

const MOTES = 46

function moteGeometry() {
  const g = new BufferGeometry()
  const seed = new Float32Array(MOTES * 4)
  for (let i = 0; i < MOTES; i++) {
    seed[i * 4] = Math.random() * Math.PI * 2
    seed[i * 4 + 1] = 0.3 + Math.random() * 0.4
    seed[i * 4 + 2] = Math.random()
    seed[i * 4 + 3] = Math.random()
  }
  g.setAttribute('position', new BufferAttribute(new Float32Array(MOTES * 3), 3))
  g.setAttribute('aSeed', new BufferAttribute(seed, 4))
  return g
}

const MOTE_VERT = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uLevel;
  uniform float uSize;
  uniform float uScale;
  varying float vA;
  varying float vSpin;
  void main() {
    float t = fract(uTime * (0.3 + aSeed.w * 0.35) + aSeed.z);
    float dir = aSeed.z > 0.5 ? 1.0 : -1.0;
    float ang = aSeed.x + uTime * (0.5 + aSeed.w * 0.7) * dir;
    float r = aSeed.y * (1.0 + t * 0.35);
    vec3 p = vec3(cos(ang) * r, 0.05 + t * 2.6, sin(ang) * r);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uScale * (0.6 + aSeed.w * 0.7) * (1.0 - t * 0.5) / -mv.z;
    // Only some of the particles show when standing still; all of them while running.
    float shown = step(aSeed.w, uLevel);
    vA = sin(t * 3.1416) * shown;
    vSpin = aSeed.x * 3.0 + uTime * 3.0 * (aSeed.w - 0.5);
  }
`

const MOTE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uCore;
  uniform float uStyle;
  varying float vA;
  varying float vSpin;
  void main() {
    if (vA <= 0.01) discard;
    vec2 c = gl_PointCoord - 0.5;
    float cs = cos(vSpin);
    float sn = sin(vSpin);
    c = mat2(cs, -sn, sn, cs) * c;
    float d;
    if (uStyle == 1.0 || uStyle == 3.0 || uStyle == 6.0) d = length(c * vec2(2.3, 1.0)); // petals, leaves, feathers
    else if (uStyle == 2.0 || uStyle == 0.0) d = min(length(c * vec2(5.0, 1.0)), length(c * vec2(1.0, 5.0))); // sparkles
    else d = length(c) * 1.1; // embers, sand, energy
    float a = smoothstep(0.5, 0.05, d);
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(uColor, uCore, a * a), a * vA);
  }
`

const additive = { transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false }

/**
 * The aura particles around one body. Place it at the feet. `motionRef.current.speed`
 * makes more of them rise while running; `hiddenRef` (optional) hides it, e.g. while dead.
 */
export function BodyAura({ aura, motionRef, hiddenRef }) {
  const size = useThree((s) => s.size.height)
  const material = useMemo(() => {
    const color = new Color(aura.color)
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uLevel: { value: 0.35 },
        uStyle: { value: STYLE_ID[aura.fx] ?? 0 },
        uColor: { value: color },
        uCore: { value: color.clone().lerp(new Color('#ffffff'), 0.55) },
        uSize: { value: 0.2 + aura.power * 0.12 },
        uScale: { value: 450 },
      },
      vertexShader: MOTE_VERT,
      fragmentShader: MOTE_FRAG,
      ...additive,
    })
  }, [aura])
  const geometry = useMemo(() => moteGeometry(), [])
  const points = useRef(null)

  useFrame((_s, dt) => {
    const pt = points.current
    if (!pt) return
    pt.visible = !hiddenRef?.current
    const u = pt.material.uniforms
    const mo = motionRef?.current
    const want = mo && mo.speed > 2 ? 1 : 0.35
    u.uLevel.value += (want - u.uLevel.value) * (1 - Math.exp(-Math.min(dt, 0.1) * 4))
    u.uTime.value = clock()
    u.uScale.value = size * 0.5
  })

  return <points ref={points} geometry={geometry} material={material} renderOrder={6} frustumCulled={false} />
}

/* ------------------------------------------------------------------------ */
/* Footprints                                                                */
/* ------------------------------------------------------------------------ */

const PRINT_GEO = new PlaneGeometry(0.42, 0.68).rotateX(-Math.PI / 2)

const PRINT_VERT = /* glsl */ `
  attribute float aBirth;
  attribute vec3 aColor;
  uniform float uTime;
  varying vec2 vUv;
  varying float vFade;
  varying vec3 vColor;
  void main() {
    vUv = uv;
    vColor = aColor;
    float age = uTime - aBirth;
    vFade = smoothstep(0.0, 0.06, age) * (1.0 - smoothstep(${(PRINT_LIFE * 0.4).toFixed(2)}, ${PRINT_LIFE.toFixed(2)}, age));
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`

const PRINT_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying float vFade;
  varying vec3 vColor;
  void main() {
    if (vFade <= 0.0) discard;
    vec2 q = (vUv - 0.5) * 2.0;
    // Sole: narrow heel, wide ball of the foot.
    float w = mix(0.46, 0.7, smoothstep(-0.9, 0.3, q.y));
    float sole = length(vec2(q.x / w, (q.y + 0.12) / 0.74));
    // Toes, big toe on the inside.
    float toes = 9.0;
    toes = min(toes, length(q - vec2(-0.36, 0.8)) / 0.19);
    toes = min(toes, length(q - vec2(-0.02, 0.86)) / 0.15);
    toes = min(toes, length(q - vec2(0.26, 0.8)) / 0.13);
    toes = min(toes, length(q - vec2(0.48, 0.68)) / 0.11);
    float d = min(sole, toes);
    float shape = smoothstep(1.02, 0.8, d);
    float glow = smoothstep(1.7, 0.9, d) * 0.4;
    float a = (shape * 0.9 + glow) * vFade;
    if (a < 0.01) discard;
    // Bright centre, the aura's colour round the edge.
    float core = smoothstep(0.95, 0.35, d);
    gl_FragColor = vec4(mix(vColor * 1.15, vec3(1.0), core * 0.45), a);
  }
`

/** One instanced mesh holding every footprint in the lobby. Mount once. */
export function FootPrints() {
  const mesh = useRef(null)
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: PRINT_VERT,
        fragmentShader: PRINT_FRAG,
        side: DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
        // Normal blending: additive washes out to white on bright sand and stone.
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )
  const geometry = useMemo(() => {
    const g = PRINT_GEO.clone()
    g.setAttribute('aBirth', printState.birth)
    g.setAttribute('aColor', printState.color)
    return g
  }, [])

  useLayoutEffect(() => {
    const m = mesh.current
    _obj.position.set(0, -999, 0)
    _obj.rotation.set(0, 0, 0)
    _obj.scale.set(1, 1, 1)
    _obj.updateMatrix()
    for (let i = 0; i < PRINTS; i++) m.setMatrixAt(i, _obj.matrix)
    m.instanceMatrix.needsUpdate = true
    printState.mesh = m
    return () => {
      if (printState.mesh === m) printState.mesh = null
    }
  }, [])

  useFrame(() => {
    const m = mesh.current
    if (m) m.material.uniforms.uTime.value = clock()
  })

  return <instancedMesh ref={mesh} args={[geometry, material, PRINTS]} frustumCulled={false} renderOrder={3} />
}

export default BodyAura
