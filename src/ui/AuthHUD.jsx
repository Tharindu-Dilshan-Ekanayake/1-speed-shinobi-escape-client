import { useBloxity } from '../bloxity/BloxityContext'

/**
 * Compact profile pill in the top-right corner, above the pass shortcuts.
 *
 * Uses the `getUser() || getGuest()` pattern (surfaced as `identity` on the context)
 * so there is always a name and picture to show, even before the player logs in.
 */
export function AuthHUD() {
  const { identity, isLoggedIn, login, logout, status, error } = useBloxity()

  const name = identity?.displayName || identity?.username || 'Guest'
  const pfp = identity?.pfp

  return (
    <div className="pointer-events-none absolute right-[1.4rem] top-[1.2rem] z-20 flex flex-col items-end gap-2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/55 py-[0.4rem] pl-[0.4rem] pr-[0.6rem] text-white backdrop-blur">
        {pfp ? (
          <img src={pfp} alt="" className="h-[3.6rem] w-[3.6rem] rounded-full object-cover ring-2 ring-white/40" />
        ) : (
          <div className="flex h-[3.6rem] w-[3.6rem] items-center justify-center rounded-full bg-white/20 text-[1.6rem] font-bold">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="max-w-[14rem] truncate text-[1.5rem] font-semibold leading-tight">{name}</div>
        {isLoggedIn ? (
          <button
            type="button"
            onClick={logout}
            className="rounded-full bg-white/15 px-3 py-1 text-[1.2rem] font-semibold transition hover:bg-white/25"
          >
            Log out
          </button>
        ) : (
          <button
            type="button"
            onClick={login}
            disabled={status !== 'ready'}
            className="rounded-full bg-violet-600 px-3 py-1 text-[1.2rem] font-bold transition hover:bg-violet-500 disabled:opacity-50"
          >
            {status === 'ready' ? 'Log in' : '…'}
          </button>
        )}
      </div>

      {status === 'error' && (
        <div className="max-w-[26rem] rounded-lg bg-red-600/80 px-3 py-2 text-[1.1rem] text-white">
          Bloxity SDK failed to load. {error?.message}
        </div>
      )}
    </div>
  )
}

export default AuthHUD
