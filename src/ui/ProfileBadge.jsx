import { useBloxity } from '../bloxity/BloxityContext'

/**
 * The player's name and picture in the top-right corner. Display only: players sign
 * in on the Bloxity site that hosts the game, so there is no login or logout here.
 * Signed-out players show as their Bloxity guest identity.
 */
export function ProfileBadge() {
  const { identity } = useBloxity()
  const name = identity?.displayName || identity?.username || 'Guest'
  const pfp = identity?.pfp

  return (
    <div className="pointer-events-none absolute right-[1.4rem] top-[1.2rem] z-20 flex items-center gap-2 rounded-full bg-black/55 py-[0.4rem] pl-[0.4rem] pr-[1.1rem] text-white backdrop-blur">
      {pfp ? (
        <img src={pfp} alt="" className="h-[3.6rem] w-[3.6rem] rounded-full object-cover ring-2 ring-white/40" />
      ) : (
        <div className="flex h-[3.6rem] w-[3.6rem] items-center justify-center rounded-full bg-white/20 text-[1.6rem] font-bold">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="max-w-[16rem] truncate text-[1.5rem] font-semibold leading-tight">{name}</div>
    </div>
  )
}

export default ProfileBadge
