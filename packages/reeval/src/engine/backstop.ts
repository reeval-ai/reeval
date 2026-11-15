// The running attempt's backstop timer, reached through async context so a sandbox can hold it
// while the attempt waits in a queue for a machine. It imports nothing else of the engine, so
// sandbox code loads it without the engine's dependencies.
import { AsyncLocalStorage } from 'node:async_hooks'

/** Holds the timer until the returned function is called; holds may overlap. */
export type Backstop = { hold(): () => void }

/** The current attempt's backstop, if it has a timeout. */
export const backstops = new AsyncLocalStorage<Backstop>()

/** Calls `fire` once `ms` have passed outside holds: paused while any is open, then resumed. */
export function backstopTimer(ms: number, fire: () => void): Backstop & { clear(): void } {
  let left = ms
  let since = Date.now()
  let holds = 0
  let cleared = false
  let timer = setTimeout(fire, left)
  return {
    hold() {
      if (holds++ === 0 && !cleared) {
        clearTimeout(timer)
        left -= Date.now() - since
      }
      let released = false
      return () => {
        if (released) return
        released = true
        if (--holds === 0 && !cleared) {
          since = Date.now()
          timer = setTimeout(fire, Math.max(0, left))
        }
      }
    },
    clear() {
      cleared = true
      clearTimeout(timer)
    },
  }
}
