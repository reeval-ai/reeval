// biome-ignore lint/suspicious/noShadowRestrictedNames: reeval's EvalError stands in for the global one
import { type TrialContext, EvalError } from 'reeval'

/** Stops the trial with an `EvalError` when `file` isn't there after the agent's turn. */
export async function built(c: TrialContext, file: string): Promise<void> {
  await c.send('write the app')
  const r = await c.exec(`test -f ${file} || { echo "no ${file}" >&2; exit 3; }`)
  if (r.exitCode !== 0) {
    throw new EvalError({
      reason: 'the build fails',
      meta: { exitCode: r.exitCode, stderr: r.stderr.trim() },
    })
  }
}
