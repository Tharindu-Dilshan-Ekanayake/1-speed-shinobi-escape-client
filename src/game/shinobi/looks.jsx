/* eslint-disable react-refresh/only-export-components -- a data module of JSX builders, not a hot-reloaded component file */
import { B, Ball, Cyl, ring, Spikes } from './prims'

/**
 * What every character looks like: sixteen original anime-style ninja, built from
 * blocks on a classic R6-style body.
 *
 * Spaces (see ShinobiModel):
 *   head  - origin at the neck, head cube centred at y 0.22 (0.42 wide), face at z +0.21
 *   torso - origin at the hips, torso block y 0..0.72, front at z +0.18
 *   arm   - origin at the shoulder, arm block y +0.06..-0.66
 *   leg   - origin at the hip joint, leg block y 0..-0.72
 * Every character faces +Z.
 */

const WHITE = '#ffffff'
const BLACK = '#15151c'
const GOLD = '#ffc93a'
const SKIN = '#f6cfab'
const SKIN_TAN = '#e2ae82'

/* ------------------------------------------------------------------------ */
/* Shared parts                                                              */
/* ------------------------------------------------------------------------ */

/** Big glossy anime eyes with two highlights, lash line, optional brows and mouth. */
function Face({ iris = '#1b1b1b', mouth = '#7a2a2a', noMouth, glow, brow, sharp }) {
  const eye = (side) => {
    const x = side * 0.088
    const ix = x - side * 0.006
    return (
      <group key={side}>
        <B p={[x, 0.235, 0.211]} s={[0.11, sharp ? 0.07 : 0.095, 0.008]} c={WHITE} rough={0.4} />
        <B p={[ix, 0.23, 0.215]} s={[0.068, sharp ? 0.06 : 0.085, 0.006]} c={iris} glow={glow} rough={0.3} />
        <B p={[ix, 0.226, 0.218]} s={[0.034, 0.045, 0.004]} c="#0a0a0a" />
        <B p={[ix + 0.016, 0.25, 0.221]} s={[0.022, 0.022, 0.003]} c={WHITE} />
        <B p={[ix - 0.014, 0.21, 0.221]} s={[0.011, 0.011, 0.003]} c={WHITE} />
        <B p={[x, 0.28, 0.217]} s={[0.126, 0.02, 0.008]} r={[0, 0, side * (sharp ? 0.28 : 0.12)]} c="#111111" />
        {brow && <B p={[x, 0.318, 0.214]} s={[0.1, 0.018, 0.008]} r={[0, 0, side * -0.15]} c={brow} />}
      </group>
    )
  }
  return (
    <>
      {eye(1)}
      {eye(-1)}
      {!noMouth && (
        <>
          <B p={[0, 0.105, 0.212]} s={[0.06, 0.016, 0.006]} c={mouth} />
          <B p={[0.036, 0.111, 0.212]} s={[0.022, 0.014, 0.006]} r={[0, 0, 0.5]} c={mouth} />
          <B p={[-0.036, 0.111, 0.212]} s={[0.022, 0.014, 0.006]} r={[0, 0, -0.5]} c={mouth} />
        </>
      )}
    </>
  )
}

/** Hair covering the top, back and sides of the head. */
function Cap({ c, back = true, sides = true, top = 0.38, backLen = 0.3 }) {
  return (
    <>
      <B p={[0, top, 0]} s={[0.46, 0.15, 0.46]} c={c} />
      {back && <B p={[0, 0.4 - backLen / 2, -0.2]} s={[0.46, backLen, 0.1]} c={c} />}
      {sides && <B p={[0.215, 0.3, -0.03]} s={[0.05, 0.16, 0.36]} c={c} />}
      {sides && <B p={[-0.215, 0.3, -0.03]} s={[0.05, 0.16, 0.36]} c={c} />}
    </>
  )
}

/** Plain cloth band round the forehead, tails at the back. */
function Band({ c, y = 0.31, tails = true }) {
  return (
    <>
      <B p={[0, y, 0]} s={[0.445, 0.07, 0.445]} c={c} />
      {tails && <B p={[0.06, y - 0.12, -0.235]} s={[0.05, 0.2, 0.02]} r={[0, 0, 0.25]} c={c} />}
      {tails && <B p={[-0.06, y - 0.12, -0.235]} s={[0.05, 0.2, 0.02]} r={[0, 0, -0.25]} c={c} />}
    </>
  )
}

/** Cloth over the nose and mouth. */
function LowerMask({ c }) {
  return <B p={[0, 0.12, 0.2]} s={[0.44, 0.17, 0.06]} c={c} />
}

/** A hood over the head, open at the face. */
function Hood({ c, deep = false }) {
  return (
    <>
      <B p={[0, 0.42, -0.02]} s={[0.5, 0.12, 0.5]} c={c} />
      <B p={[0, 0.22, -0.23]} s={[0.5, 0.46, 0.08]} c={c} />
      <B p={[0.235, 0.22, -0.02]} s={[0.05, 0.44, 0.46]} c={c} />
      <B p={[-0.235, 0.22, -0.02]} s={[0.05, 0.44, 0.46]} c={c} />
      {deep && <B p={[0, 0.39, 0.22]} s={[0.5, 0.08, 0.06]} c={c} />}
    </>
  )
}

/** Round goggles pushed up on the forehead. */
function Goggles({ lens, y = 0.34 }) {
  return (
    <>
      <B p={[0, y, 0]} s={[0.45, 0.05, 0.45]} c="#3a2a1a" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Cyl p={[side * 0.1, y, 0.225]} radius={0.065} h={0.05} r={[Math.PI / 2, 0, 0]} c="#6a5a4a" />
          <Cyl p={[side * 0.1, y, 0.25]} radius={0.05} h={0.01} r={[Math.PI / 2, 0, 0]} c={lens} glow={0.6} />
        </group>
      ))}
    </>
  )
}

/** A wide scarf round the neck with a tail blowing back. */
function Scarf({ c }) {
  return (
    <>
      <B p={[0, 0.74, 0]} s={[0.56, 0.16, 0.44]} c={c} />
      <B p={[0.14, 0.52, -0.25]} s={[0.16, 0.42, 0.05]} r={[0.25, 0, 0.1]} c={c} />
    </>
  )
}

/** A belt / obi across the waist. */
function Belt({ c, y = 0.06, knot }) {
  return (
    <>
      <B p={[0, y, 0]} s={[0.745, 0.12, 0.38]} c={c} />
      {knot && <B p={[0.2, y - 0.1, 0.19]} s={[0.08, 0.2, 0.03]} r={[0, 0, 0.3]} c={knot} />}
    </>
  )
}

/** Long cape hanging from the shoulders. */
function Cape({ c, lining, len = 1.2, dots }) {
  return (
    <>
      <B p={[0, 0.72 - len / 2, -0.21]} s={[0.78, len, 0.05]} c={c} />
      {lining && <B p={[0, 0.72 - len / 2, -0.185]} s={[0.7, len - 0.06, 0.01]} c={lining} />}
      {dots?.map(([x, y], i) => (
        <B key={i} p={[x, y, -0.24]} s={[0.035, 0.035, 0.01]} c={WHITE} glow={1.4} />
      ))}
    </>
  )
}

/** Shoulder armour plates. */
function Pauldrons({ c, trim }) {
  return [-1, 1].map((side) => (
    <group key={side}>
      <B p={[side * 0.42, 0.72, 0]} s={[0.34, 0.12, 0.44]} r={[0, 0, side * -0.25]} c={c} metal={0.5} rough={0.35} />
      {trim && <B p={[side * 0.43, 0.66, 0]} s={[0.36, 0.03, 0.46]} r={[0, 0, side * -0.25]} c={trim} />}
    </group>
  ))
}

/** Sword worn diagonally across the back. */
function BackSword({ blade = '#d8dde6', grip = '#2a1a14', guard = GOLD }) {
  return (
    <group position={[0, 0.4, -0.22]} rotation={[0, 0, 0.7]}>
      <B p={[0, 0.25, 0]} s={[0.05, 0.9, 0.03]} c={blade} metal={0.7} rough={0.2} />
      <B p={[0, -0.24, 0]} s={[0.14, 0.04, 0.05]} c={guard} />
      <B p={[0, -0.38, 0]} s={[0.05, 0.24, 0.05]} c={grip} />
    </group>
  )
}

/* ------------------------------------------------------------------------ */
/* The sixteen                                                               */
/* ------------------------------------------------------------------------ */

export const LOOKS = {
  // Teal-haired runner in a white hoodie: the starter.
  kaito: {
    skin: SKIN,
    shirt: '#f2f4f8',
    sleeve: '#f2f4f8',
    forearm: '#2fb8ac',
    hand: SKIN,
    pants: '#4a5060',
    shins: '#4a5060',
    shoe: '#2fb8ac',
    head: () => (
      <>
        <Face iris="#1faaa0" brow="#1d6f68" />
        <Cap c="#2a8f86" />
        <Spikes c="#2a8f86" center={[0, 0.34, -0.02]} list={ring(7, 10, 0.26, 0.085, 150, 60)} />
        <Spikes c="#2a8f86" center={[0, 0.36, 0.06]} list={[[-20, -30, 0.16], [15, -35, 0.16]]} />
      </>
    ),
    torso: () => (
      <>
        <B p={[0, 0.72, -0.19]} s={[0.5, 0.16, 0.12]} c="#e2e6ee" />
        <B p={[0, 0.34, 0.185]} s={[0.36, 0.2, 0.02]} c="#2fb8ac" />
        <B p={[0, 0.02, 0]} s={[0.74, 0.08, 0.38]} c="#2fb8ac" />
      </>
    ),
  },

  // Lavender hair with a flower pin, mint kimono and a purple obi.
  hana: {
    skin: SKIN,
    shirt: '#9fe0c4',
    sleeve: '#9fe0c4',
    forearm: '#9fe0c4',
    hand: SKIN,
    pants: '#f0eef6',
    shins: '#f0eef6',
    shoe: '#8a5ac8',
    head: () => (
      <>
        <Face iris="#8a4ac8" mouth="#b04a6a" />
        <Cap c="#b99ae8" backLen={0.5} />
        <B p={[0.2, 0.12, 0.08]} s={[0.07, 0.36, 0.1]} c="#b99ae8" />
        <B p={[-0.2, 0.12, 0.08]} s={[0.07, 0.36, 0.1]} c="#b99ae8" />
        <B p={[-0.07, 0.35, 0.215]} s={[0.26, 0.08, 0.03]} c="#b99ae8" />
        {[0, 72, 144, 216, 288].map((a) => (
          <Ball key={a} p={[0.17 + Math.cos((a * Math.PI) / 180) * 0.04, 0.37 + Math.sin((a * Math.PI) / 180) * 0.04, 0.2]} s={0.035} c="#ff8ac0" />
        ))}
        <Ball p={[0.17, 0.37, 0.22]} s={0.025} c={GOLD} />
      </>
    ),
    torso: () => (
      <>
        <B p={[0.08, 0.55, 0.186]} s={[0.26, 0.34, 0.01]} r={[0, 0, 0.5]} c="#e8f8f0" />
        <Belt c="#8a5ac8" y={0.24} knot="#b99ae8" />
        <B p={[0, 0.1, 0]} s={[0.76, 0.3, 0.39]} c="#8fd6b8" />
      </>
    ),
    arm: () => <B p={[0, -0.5, 0]} s={[0.42, 0.28, 0.42]} c="#9fe0c4" />,
  },

  // Crimson top-knot, black gi, gold belt and wrapped forearms.
  ryu: {
    skin: SKIN_TAN,
    shirt: '#22222a',
    sleeve: '#22222a',
    forearm: '#efe6d6',
    hand: SKIN_TAN,
    pants: '#22222a',
    shins: '#22222a',
    shoe: '#5a3a22',
    head: () => (
      <>
        <Face iris="#d88a1a" brow="#7a1414" sharp />
        <Cap c="#a8141c" />
        <Ball p={[0, 0.5, -0.08]} s={0.1} c="#a8141c" />
        <B p={[0, 0.44, -0.08]} s={[0.1, 0.05, 0.1]} c={GOLD} />
      </>
    ),
    torso: () => (
      <>
        <B p={[0.07, 0.5, 0.186]} s={[0.05, 0.44, 0.01]} r={[0, 0, 0.45]} c="#3a3a44" />
        <Belt c={GOLD} knot={GOLD} />
      </>
    ),
    arm: () => <B p={[0, -0.36, 0]} s={[0.37, 0.03, 0.37]} c="#c8bca8" />,
  },

  // Sky-blue hair in two buns, yellow tech jacket, glowing headphones.
  mira: {
    skin: SKIN,
    shirt: '#ffd23a',
    sleeve: '#ffd23a',
    forearm: '#ffd23a',
    hand: '#2a2f3a',
    pants: '#2a2f3a',
    shins: '#9aa3b2',
    shoe: '#39c8ff',
    head: () => (
      <>
        <Face iris="#2a8aff" />
        <Cap c="#6fc8ff" />
        <Ball p={[0.17, 0.48, -0.02]} s={0.09} c="#6fc8ff" />
        <Ball p={[-0.17, 0.48, -0.02]} s={0.09} c="#6fc8ff" />
        <B p={[0, 0.34, 0.215]} s={[0.4, 0.07, 0.03]} c="#6fc8ff" />
        <B p={[0, 0.47, 0]} s={[0.46, 0.04, 0.08]} c="#2a2f3a" />
        {[-1, 1].map((side) => (
          <group key={side}>
            <Cyl p={[side * 0.235, 0.24, 0]} radius={0.085} h={0.06} r={[0, 0, Math.PI / 2]} c="#2a2f3a" />
            <Cyl p={[side * 0.27, 0.24, 0]} radius={0.05} h={0.01} r={[0, 0, Math.PI / 2]} c="#39e0ff" glow={1.2} />
          </group>
        ))}
      </>
    ),
    torso: () => (
      <>
        <B p={[0, 0.36, 0.186]} s={[0.03, 0.62, 0.01]} c="#2a2f3a" />
        <B p={[0.2, 0.5, 0.188]} s={[0.12, 0.04, 0.01]} c="#39e0ff" glow={1} />
        <B p={[0, 0.7, 0]} s={[0.5, 0.1, 0.4]} c="#2a2f3a" />
      </>
    ),
  },

  // Buzz cut, green bandana and a huge green scarf.
  takeshi: {
    skin: SKIN_TAN,
    shirt: '#c8b48a',
    sleeve: '#c8b48a',
    forearm: SKIN_TAN,
    hand: SKIN_TAN,
    pants: '#6a6a4a',
    shins: '#4a3a2a',
    shoe: '#3a2a1a',
    head: () => (
      <>
        <Face iris="#5a3a1a" brow="#3a2a1a" />
        <Cap c="#4a3222" top={0.39} sides={false} />
        <Band c="#3fae3a" y={0.33} />
      </>
    ),
    torso: () => (
      <>
        <Scarf c="#3fae3a" />
        <B p={[0.2, 0.26, 0.186]} s={[0.16, 0.14, 0.02]} c="#b09a70" />
        <B p={[-0.2, 0.26, 0.186]} s={[0.16, 0.14, 0.02]} c="#b09a70" />
        <Belt c="#4a3a2a" />
      </>
    ),
    leg: () => <B p={[0, -0.28, 0.17]} s={[0.2, 0.16, 0.04]} c="#5a5a3c" />,
  },

  // Desert wanderer: sand hood, face wrap, amber goggles.
  suna: {
    skin: SKIN_TAN,
    shirt: '#d9b77a',
    sleeve: '#d9b77a',
    forearm: '#b8935a',
    hand: SKIN_TAN,
    pants: '#b8935a',
    shins: '#8a6a3a',
    shoe: '#6a4a2a',
    head: () => (
      <>
        <Face iris="#2ea35a" noMouth />
        <Hood c="#c9a468" deep />
        <LowerMask c="#e8d4a8" />
        <Goggles lens="#ffb13a" y={0.39} />
      </>
    ),
    torso: () => (
      <>
        <B p={[0, 0.3, 0]} s={[0.76, 0.3, 0.39]} c="#c9a468" />
        <B p={[0.1, 0.5, 0.188]} s={[0.08, 0.5, 0.01]} r={[0, 0, 0.6]} c="#7a4a22" />
      </>
    ),
  },

  // Ice-blue hair and a white coat with a fluffy blue collar.
  yuki: {
    skin: '#fbe2d0',
    shirt: '#f4f8ff',
    sleeve: '#f4f8ff',
    forearm: '#f4f8ff',
    hand: '#9fe6ff',
    pants: '#3a4a6a',
    shins: '#f4f8ff',
    shoe: '#9fe6ff',
    head: () => (
      <>
        <Face iris="#39b8ff" glow={0.4} />
        <Cap c="#bfe8ff" backLen={0.55} />
        <B p={[-0.1, 0.35, 0.215]} s={[0.22, 0.09, 0.03]} r={[0, 0, -0.2]} c="#bfe8ff" />
        <Spikes c="#bfe8ff" center={[0, 0.2, -0.2]} list={ring(4, -60, 0.22, 0.07, 150, 60)} />
      </>
    ),
    torso: () => (
      <>
        {[-0.24, -0.08, 0.08, 0.24].map((x) => (
          <Ball key={x} p={[x, 0.74, 0.04]} s={0.11} c="#7fcff0" />
        ))}
        <B p={[0, 0.1, 0]} s={[0.78, 0.3, 0.4]} c="#f4f8ff" />
        <B p={[0, 0.36, 0.186]} s={[0.03, 0.66, 0.01]} c="#9fe6ff" />
      </>
    ),
    leg: () => <B p={[0, -0.02, 0]} s={[0.37, 0.24, 0.37]} c="#f4f8ff" />,
  },

  // Shadow ninja: hooded, fully masked, glowing purple visor.
  kage: {
    skin: '#2a2a34',
    shirt: BLACK,
    sleeve: BLACK,
    forearm: '#3a2a5a',
    hand: BLACK,
    pants: BLACK,
    shins: '#3a2a5a',
    shoe: BLACK,
    head: () => (
      <>
        <Hood c={BLACK} deep />
        <B p={[0, 0.16, 0.215]} s={[0.4, 0.28, 0.02]} c="#22222c" />
        <B p={[0, 0.24, 0.23]} s={[0.3, 0.05, 0.01]} c="#b06bff" glow={2} />
      </>
    ),
    torso: () => (
      <>
        <B p={[0, 0.36, 0.186]} s={[0.1, 0.66, 0.01]} r={[0, 0, 0.4]} c="#3a2a5a" />
        <Belt c="#3a2a5a" knot="#b06bff" />
      </>
    ),
    arm: () => <B p={[0, -0.45, 0.1]} s={[0.39, 0.28, 0.24]} c="#4a3a6a" metal={0.4} />,
  },

  // Red high ponytail, crimson armour and a sword on her back.
  akane: {
    skin: SKIN,
    shirt: '#9a1a24',
    sleeve: '#22222a',
    forearm: '#9a1a24',
    hand: SKIN,
    pants: '#22222a',
    shins: '#9a1a24',
    shoe: '#22222a',
    head: () => (
      <>
        <Face iris="#c8141c" brow="#8a1014" sharp />
        <Cap c="#e02a2a" />
        <Ball p={[0, 0.46, -0.16]} s={0.07} c="#e02a2a" />
        <B p={[0, 0.2, -0.3]} s={[0.12, 0.5, 0.1]} r={[0.35, 0, 0]} c="#e02a2a" />
        <B p={[0.08, 0.35, 0.215]} s={[0.24, 0.08, 0.03]} r={[0, 0, 0.2]} c="#e02a2a" />
      </>
    ),
    torso: () => (
      <>
        <B p={[0, 0.44, 0]} s={[0.76, 0.46, 0.4]} c="#b8242e" metal={0.4} rough={0.4} />
        <B p={[0, 0.44, 0.205]} s={[0.5, 0.03, 0.01]} c={GOLD} />
        <B p={[0, 0.3, 0.205]} s={[0.5, 0.03, 0.01]} c={GOLD} />
        <Pauldrons c="#b8242e" trim={GOLD} />
        <BackSword />
      </>
    ),
  },

  // Lime mohawk, wind goggles, sleeveless vest and a streaming scarf.
  zephyr: {
    skin: SKIN_TAN,
    shirt: '#e8dcb8',
    sleeve: SKIN_TAN,
    forearm: '#f0f0e0',
    hand: SKIN_TAN,
    pants: '#3a5a4a',
    shins: '#3a5a4a',
    shoe: '#b8ff3a',
    head: () => (
      <>
        <Face iris="#6fd02a" brow="#4a7a1a" />
        <B p={[0, 0.33, 0]} s={[0.44, 0.1, 0.44]} c="#4a3a2a" />
        <Spikes c="#b8ff3a" center={[0, 0.4, 0]} list={[[0, 70, 0.22, 0.07], [180, 60, 0.22, 0.07], [0, 88, 0.24, 0.07], [180, 30, 0.2, 0.07], [0, 40, 0.2, 0.07]]} />
        <Goggles lens="#b8ff3a" y={0.31} />
      </>
    ),
    torso: () => (
      <>
        <B p={[0.21, 0.4, 0.186]} s={[0.24, 0.6, 0.01]} c="#8a7a4a" />
        <B p={[-0.21, 0.4, 0.186]} s={[0.24, 0.6, 0.01]} c="#8a7a4a" />
        <Scarf c="#d8ff5a" />
        <Belt c="#4a3a2a" />
      </>
    ),
  },

  // Cosmic ninja: violet hair with star glints and a starry cape.
  nova: {
    skin: '#f4d8c8',
    shirt: '#241a4a',
    sleeve: '#241a4a',
    forearm: '#241a4a',
    hand: '#b06bff',
    pants: '#241a4a',
    shins: '#3a2a6a',
    shoe: '#b06bff',
    glow: 0.05,
    head: () => (
      <>
        <Face iris="#b06bff" glow={0.8} />
        <Cap c="#5a2a9a" backLen={0.5} />
        <B p={[0.1, 0.35, 0.215]} s={[0.24, 0.08, 0.03]} r={[0, 0, 0.25]} c="#5a2a9a" />
        <B p={[0, 0.33, 0]} s={[0.455, 0.035, 0.455]} c="#d8dde6" metal={0.7} />
        <Ball p={[0, 0.33, 0.23]} s={0.035} c="#e8b8ff" glow={2} />
        {[[0.12, 0.45, 0.1], [-0.15, 0.4, -0.12], [0.18, 0.2, -0.22]].map((p, i) => (
          <Ball key={i} p={p} s={0.018} c={WHITE} glow={2} />
        ))}
      </>
    ),
    torso: () => (
      <>
        <Cape c="#1a1240" lining="#5a2a9a" dots={[[0.2, 0.4], [-0.1, 0.1], [0.05, -0.3], [-0.25, -0.1], [0.15, -0.05]]} />
        <B p={[0, 0.72, 0]} s={[0.6, 0.1, 0.42]} c="#5a2a9a" />
        <Ball p={[0, 0.66, 0.2]} s={0.05} c="#e8b8ff" glow={1.6} />
      </>
    ),
    aura: '#b06bff',
  },

  // Golden armour, horned helm and a red cape.
  oro: {
    skin: SKIN_TAN,
    shirt: '#d8a820',
    sleeve: '#d8a820',
    forearm: '#d8a820',
    hand: '#b08818',
    pants: '#3a2a1a',
    shins: '#d8a820',
    shoe: '#b08818',
    head: () => (
      <>
        <Face iris="#ffb21a" glow={0.5} sharp />
        <B p={[0, 0.4, 0]} s={[0.48, 0.14, 0.48]} c="#e8b820" metal={0.7} rough={0.3} />
        <B p={[0, 0.25, -0.22]} s={[0.48, 0.3, 0.06]} c="#e8b820" metal={0.7} rough={0.3} />
        <B p={[0, 0.34, 0.24]} s={[0.06, 0.2, 0.02]} c="#b08818" />
        <Spikes c="#fff0b0" center={[0, 0.42, 0]} list={[[90, 35, 0.3, 0.06], [-90, 35, 0.3, 0.06]]} metal={0.5} />
      </>
    ),
    torso: () => (
      <>
        <Cape c="#c01a24" len={1.1} />
        <B p={[0, 0.44, 0.19]} s={[0.5, 0.4, 0.02]} c="#f0c83a" metal={0.7} rough={0.3} />
        <Ball p={[0, 0.46, 0.21]} s={0.06} c="#ff4a3a" glow={1.2} />
        <Pauldrons c="#e8b820" trim="#fff0b0" />
      </>
    ),
    aura: GOLD,
  },

  // White fox mask with red markings under an orange hood.
  kitsune: {
    skin: SKIN,
    shirt: '#f4f0ea',
    sleeve: '#ff7a3a',
    forearm: '#f4f0ea',
    hand: SKIN,
    pants: '#2a2a32',
    shins: '#f4f0ea',
    shoe: '#2a2a32',
    head: () => (
      <>
        <Hood c="#ff7a3a" />
        <B p={[0, 0.2, 0.22]} s={[0.4, 0.36, 0.03]} c={WHITE} />
        <B p={[0, 0.12, 0.25]} s={[0.14, 0.12, 0.05]} c={WHITE} />
        <B p={[0.09, 0.26, 0.24]} s={[0.1, 0.025, 0.01]} r={[0, 0, 0.35]} c="#d8141c" />
        <B p={[-0.09, 0.26, 0.24]} s={[0.1, 0.025, 0.01]} r={[0, 0, -0.35]} c="#d8141c" />
        <B p={[0, 0.34, 0.24]} s={[0.03, 0.08, 0.01]} c="#d8141c" />
        <B p={[0, 0.07, 0.27]} s={[0.04, 0.03, 0.01]} c="#1a1a1a" />
        {[-1, 1].map((side) => (
          <B key={side} p={[side * 0.15, 0.52, 0.02]} s={[0.1, 0.14, 0.06]} r={[0, 0, side * -0.3]} c="#ff7a3a" />
        ))}
      </>
    ),
    torso: () => (
      <>
        <B p={[0.08, 0.55, 0.186]} s={[0.24, 0.34, 0.01]} r={[0, 0, 0.5]} c="#ff7a3a" />
        <Belt c="#d8141c" knot="#ff7a3a" />
        <B p={[0.08, -0.05, -0.22]} s={[0.14, 0.4, 0.14]} r={[0.5, 0, 0]} c="#ffb070" />
      </>
    ),
  },

  // Black feather cloak and a red long-nosed mask.
  tengu: {
    skin: SKIN,
    shirt: '#1c1c24',
    sleeve: '#1c1c24',
    forearm: '#1c1c24',
    hand: SKIN,
    pants: '#f0ece4',
    shins: '#1c1c24',
    shoe: '#8a1a1a',
    head: () => (
      <>
        <Cap c="#101014" />
        <B p={[0, 0.2, 0.215]} s={[0.4, 0.3, 0.02]} c="#d8262c" />
        <B p={[0, 0.2, 0.3]} s={[0.07, 0.07, 0.18]} c="#d8262c" />
        <B p={[0.09, 0.27, 0.23]} s={[0.08, 0.03, 0.01]} c="#111" />
        <B p={[-0.09, 0.27, 0.23]} s={[0.08, 0.03, 0.01]} c="#111" />
        <B p={[0, 0.32, 0.23]} s={[0.26, 0.04, 0.01]} c={WHITE} />
        <Ball p={[0, 0.48, 0.06]} s={0.06} c="#1c1c24" />
      </>
    ),
    torso: () => (
      <>
        {[0, 1, 2, 3].map((i) => (
          <B key={i} p={[0, 0.66 - i * 0.2, -0.21 - i * 0.02]} s={[0.84 - i * 0.04, 0.22, 0.05]} c={i % 2 ? '#26262e' : '#101014'} />
        ))}
        {[-1, 1].map((side) => (
          <B key={side} p={[side * 0.46, 0.5, -0.24]} s={[0.24, 0.5, 0.04]} r={[0, 0, side * 0.5]} c="#101014" />
        ))}
        <Belt c="#8a1a1a" />
      </>
    ),
  },

  // Jade dragon armour with a snouted, horned helm.
  dragon: {
    skin: SKIN_TAN,
    shirt: '#1f8a5a',
    sleeve: '#1f8a5a',
    forearm: '#26a86c',
    hand: '#1a6a46',
    pants: '#1a3a2a',
    shins: '#26a86c',
    shoe: '#1a6a46',
    head: () => (
      <>
        <Face iris="#2fe08a" glow={1} sharp noMouth />
        <B p={[0, 0.41, 0]} s={[0.48, 0.14, 0.48]} c="#26a86c" metal={0.5} rough={0.35} />
        <B p={[0, 0.25, -0.22]} s={[0.48, 0.34, 0.06]} c="#26a86c" metal={0.5} rough={0.35} />
        <B p={[0, 0.4, 0.26]} s={[0.2, 0.1, 0.12]} c="#1f8a5a" />
        <B p={[0, 0.12, 0.215]} s={[0.4, 0.14, 0.02]} c="#1f8a5a" />
        <Spikes c={GOLD} center={[0, 0.44, -0.05]} list={[[150, 30, 0.3, 0.05], [-150, 30, 0.3, 0.05], [180, 55, 0.22, 0.05]]} />
      </>
    ),
    torso: () => (
      <>
        {[0.55, 0.4, 0.25].map((y) => (
          <B key={y} p={[0, y, 0.19]} s={[0.56, 0.1, 0.02]} c="#2fe08a" metal={0.4} />
        ))}
        <Pauldrons c="#26a86c" trim={GOLD} />
        <Cape c="#0f4a30" len={1} />
      </>
    ),
    aura: '#2fe08a',
  },

  // Glowing white-violet hair, flowing robe and a silver crown.
  spirit: {
    skin: '#fbe6f0',
    shirt: '#f4e8ff',
    sleeve: '#f4e8ff',
    forearm: '#f4e8ff',
    hand: '#fbe6f0',
    pants: '#c8a0ff',
    shins: '#f4e8ff',
    shoe: '#c8a0ff',
    glow: 0.08,
    head: () => (
      <>
        <Face iris="#c07bff" glow={1.2} mouth="#b04a8a" />
        <Cap c="#f0d8ff" backLen={0.65} />
        <B p={[0, 0.35, 0.215]} s={[0.42, 0.07, 0.03]} c="#f0d8ff" />
        <B p={[0, 0.02, -0.24]} s={[0.4, 0.4, 0.08]} c="#f0d8ff" glow={0.4} />
        {[-0.14, 0, 0.14].map((x) => (
          <B key={x} p={[x, 0.5, 0.12]} s={[0.05, x === 0 ? 0.14 : 0.09, 0.04]} c="#e8ecf4" metal={0.8} rough={0.2} />
        ))}
        <Ball p={[0, 0.5, 0.15]} s={0.03} c="#ff7ae0" glow={2} />
      </>
    ),
    torso: () => (
      <>
        <B p={[0, -0.06, 0]} s={[0.8, 0.34, 0.42]} c="#e8d4ff" />
        <Belt c="#c07bff" y={0.3} knot="#f0d8ff" />
        <Cape c="#d8b8ff" lining="#f4e8ff" len={1.3} />
      </>
    ),
    arm: () => <B p={[0, -0.52, 0]} s={[0.44, 0.3, 0.44]} c="#f4e8ff" />,
    aura: '#e0a0ff',
  },
}

/**
 * Signature poses for the lobby pedestals. Limb values are [pitch, spread] in
 * radians: negative pitch swings a limb forward/up, positive spread moves the left
 * limb outward (and the right limb inward). `fx` holds an effect in one hand
 * (side 1 = left, -1 = right): 'orb' is a spinning energy ball, 'spark' lightning.
 */
const POSES = {
  kaito: { aR: [-1.2, 0.15], aL: [-0.6, -0.3], lL: [-0.35, 0.12], lR: [0.3, -0.1], lean: 0.1, fx: { type: 'orb', side: -1, color: '#39f0e0' } },
  hana: { aL: [-2.6, 0.2], aR: [0.2, -0.3], lL: [-0.15, 0.05], lR: [0.1, -0.05] },
  ryu: { aL: [-1.5, 0.05], aR: [0.5, -0.15], lL: [-0.45, 0.15], lR: [0.35, -0.12], lean: 0.1 },
  mira: { aR: [-2.8, -0.1], aL: [0, 0.3], lL: [0, 0.1], lR: [0, -0.1], fx: { type: 'spark', side: -1, color: '#39e0ff' } },
  takeshi: { aL: [0.1, 0.5], aR: [0.1, -0.5], lL: [0, 0.14], lR: [0, -0.14] },
  suna: { aL: [-1.35, -0.55], aR: [-1.3, 0.55], lL: [0, 0.06], lR: [0, -0.06] },
  yuki: { aR: [-1.1, 0.2], aL: [0.2, 0.3], lL: [-0.3, 0.1], lR: [0.25, -0.1], fx: { type: 'orb', side: -1, color: '#bff0ff' } },
  kage: { aL: [-0.4, 0.2], aR: [-1.4, -0.4], lL: [-0.4, 0.1], lR: [0.35, -0.1], lean: 0.25 },
  akane: { aR: [-2.2, 0.3], aL: [-0.8, -0.3], lL: [-0.5, 0.14], lR: [0.35, -0.1], lean: 0.15 },
  zephyr: { aL: [-2.4, 0.9], aR: [-1.4, -0.1], lL: [-0.8, 0.35], lR: [0.3, -0.25], lean: 0.15 },
  nova: { aL: [0, 1.2], aR: [0, -1.2], lL: [0, 0.08], lR: [0, -0.08], head: 0.1, fx: { type: 'orb', side: 1, color: '#c07bff' } },
  oro: { aL: [-0.3, 0.3], aR: [-1.2, 0.2], lL: [0, 0.1], lR: [0, -0.1] },
  kitsune: { aL: [-0.9, 0.35], aR: [-0.9, -0.35], lL: [0, 0.2], lR: [0, -0.2], lean: 0.45, head: -0.3 },
  tengu: { aL: [-0.2, 0.9], aR: [-0.2, -0.9], lL: [0, 0.12], lR: [0, -0.12], fx: { type: 'spark', side: -1, color: '#ff4a3a' } },
  dragon: { aR: [-1.3, 0.15], aL: [0, 0.35], lL: [-0.3, 0.12], lR: [0.25, -0.1], fx: { type: 'orb', side: -1, color: '#2fe08a' } },
  spirit: { aL: [-0.6, 0.6], aR: [-0.6, -0.6], lL: [0, 0.08], lR: [0, -0.08], head: 0.08, fx: { type: 'spark', side: -1, color: '#e0a0ff' } },
}
for (const [id, pose] of Object.entries(POSES)) LOOKS[id].pose = pose

/* ------------------------------------------------------------------------ */
/* Ninja gear every character wears, in their own accent colour               */
/* ------------------------------------------------------------------------ */

/** Plain cloth band with a polished forehead plate (no emblem). */
function ForeheadPlate({ cloth }) {
  return (
    <>
      <B p={[0, 0.3, 0]} s={[0.445, 0.07, 0.445]} c={cloth} />
      <B p={[0, 0.3, 0.226]} s={[0.24, 0.09, 0.018]} c="#d8dde6" metal={0.7} rough={0.25} />
      <B p={[0, 0.315, 0.237]} s={[0.16, 0.012, 0.004]} c="#8a909a" />
      <B p={[0, 0.285, 0.237]} s={[0.16, 0.012, 0.004]} c="#8a909a" />
    </>
  )
}

function ArmGuard({ accent }) {
  return (
    <>
      <B p={[0, -0.44, 0.02]} s={[0.39, 0.2, 0.37]} c="#aeb4be" metal={0.6} rough={0.3} />
      <B p={[0, -0.32, 0]} s={[0.38, 0.05, 0.38]} c={accent} />
      <B p={[0, -0.55, 0]} s={[0.38, 0.04, 0.38]} c={accent} />
    </>
  )
}

function LegWrap({ accent }) {
  return (
    <>
      <B p={[0, -0.46, 0]} s={[0.375, 0.05, 0.375]} c={accent} />
      <B p={[0, -0.54, 0]} s={[0.372, 0.05, 0.372]} c="#f2f0ea" />
    </>
  )
}

/** accent: the bright colour of each character's wraps; band: wears a forehead plate. */
const GEAR = {
  kaito: { accent: '#ff7a3a', band: '#1d6f68' },
  hana: { accent: '#ff8ac0', band: '#8a5ac8' },
  ryu: { accent: '#ff5a2a', band: '#22222a' },
  mira: { accent: '#39e0ff' },
  takeshi: { accent: '#ff9a1f' },
  suna: { accent: '#ffb13a' },
  yuki: { accent: '#39b8ff', band: '#3a4a6a' },
  kage: { accent: '#b06bff' },
  akane: { accent: '#ffd23a', band: '#22222a' },
  zephyr: { accent: '#ff5aa0' },
  nova: { accent: '#e8b8ff' },
  oro: { accent: '#ff4a3a' },
  kitsune: { accent: '#ff4a3a' },
  tengu: { accent: '#ffd23a' },
  dragon: { accent: GOLD },
  spirit: { accent: '#ff7ae0' },
}

for (const [id, gear] of Object.entries(GEAR)) {
  const look = LOOKS[id]
  const { head, arm, leg } = look
  look.arm = (side) => (
    <>
      {arm?.(side)}
      <ArmGuard accent={gear.accent} />
    </>
  )
  look.leg = (side) => (
    <>
      {leg?.(side)}
      <LegWrap accent={gear.accent} />
    </>
  )
  if (gear.band) {
    look.head = () => (
      <>
        {head()}
        <ForeheadPlate cloth={gear.band} />
      </>
    )
  }
}
