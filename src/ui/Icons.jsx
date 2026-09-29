/** Small inline SVG icons for the HUD. All sized in em so they follow the text. */

/** A price in wins: small trophy + amount. */
export function WinsPrice({ price, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-[0.15em] ${className}`}>
      <TrophyIcon className="h-[1em] w-[1em] flex-none" />
      <span>{price}</span>
    </span>
  )
}

/** Blue-and-white running shoe used on the level bar and speed buttons. */
export function ShoeIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 64 48" className={className}>
      <path
        d="M6 30c0-8 4-18 12-22 3-2 7 0 9 3l6 9c6 1 14 3 20 6 6 3 7 8 5 11-2 3-7 4-14 4H14c-5 0-8-4-8-11z"
        fill="#1f6bff"
        stroke="#111"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M8 34h52c0 4-3 7-10 7H14c-4 0-6-3-6-7z" fill="#fff" stroke="#111" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M22 14l4 6M26 12l4 6M30 11l4 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function TrophyIcon({ className = '', style }) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={style}>
      <path d="M18 8h28v14c0 10-6 17-14 17s-14-7-14-17z" fill="#ffc21f" stroke="#111" strokeWidth="3.5" />
      <path d="M18 14H8c0 10 5 15 12 16M46 14h10c0 10-5 15-12 16" fill="none" stroke="#111" strokeWidth="3.5" />
      <path d="M18 14H8c0 10 5 15 12 16M46 14h10c0 10-5 15-12 16" fill="none" stroke="#ffc21f" strokeWidth="1.5" />
      <path d="M28 38h8v8h-8z" fill="#e89a10" stroke="#111" strokeWidth="3" />
      <path d="M20 46h24v8H20z" fill="#ffc21f" stroke="#111" strokeWidth="3.5" />
      <path d="M24 12h4v14c-3-2-4-6-4-10z" fill="#fff6b0" />
    </svg>
  )
}

export function LightningIcon({ className = '' }) {
  return (
    <svg viewBox="0 0 24 32" className={className}>
      <path d="M14 1 3 18h8l-3 13 13-19h-8z" fill="#ff9a1a" stroke="#6a2a00" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
