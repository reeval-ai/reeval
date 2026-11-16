// Reads reeval makes of the project's files for its own sake while an eval file or the config
// loads (the plan reading a plugin or a skill, the loader checking a tsconfig.json), which a
// load's tracking (`./inputs-load.ts`) leaves out: the evals that name those files list them
// themselves, and the tsconfig check changes nothing about how a file loads.

/** Above 0 inside `asOwnReads`. */
export const ownReads = { depth: 0 }

/** `fn`'s file reads are reeval's own, not the load's. */
export function asOwnReads<T>(fn: () => T): T {
  ownReads.depth++
  try {
    return fn()
  } finally {
    ownReads.depth--
  }
}
