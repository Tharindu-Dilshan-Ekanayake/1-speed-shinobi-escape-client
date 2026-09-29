import { Billboard, Text } from '@react-three/drei'

export const FONT_URL = '/fonts/LilitaOne-Regular.ttf'

/**
 * Chunky outlined 3D text, the Roblox BillboardGui / SurfaceGui look.
 * `billboard` always faces the camera, `flat` lies on the ground, otherwise it faces
 * +Z rotated by `rotY`.
 */
export function Label({ text, p, size = 1, color = '#fff', outline = '#1a1a1a', billboard, flat, rotY = 0, maxWidth }) {
  const node = (
    <Text
      font={FONT_URL}
      fontSize={size}
      color={color}
      outlineWidth={size * 0.09}
      outlineColor={outline}
      anchorX="center"
      anchorY="middle"
      maxWidth={maxWidth}
      textAlign="center"
      rotation={billboard ? undefined : flat ? [-Math.PI / 2, 0, 0] : [0, rotY, 0]}
      position={billboard ? undefined : p}
    >
      {text}
    </Text>
  )
  if (billboard) return <Billboard position={p}>{node}</Billboard>
  return node
}

export default Label
