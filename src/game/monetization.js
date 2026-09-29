import { sfx } from './audio'
import { getGame } from './gameStore'

/** Every shop item is paid for with wins; nothing costs Bux. */
export function purchase(key) {
  sfx('click')
  return getGame().buy(key)
}
