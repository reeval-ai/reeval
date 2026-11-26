// biome-ignore lint/suspicious/noShadowRestrictedNames: reeval's EvalError stands in for the global one
import { capability, defineEval, EvalError } from 'reeval'
import { writesGreet } from './graders.ts'

// Cases on one cell: a row per case that cost points, the one whose build fails with its
// EvalError. Cases with a change: the case outer, its arms inner, pooled into one effect.
export default defineEval({
  cases: [{ key: 'reset' }, { key: 'double' }, { key: 'clear' }],
  target: capability(),
  graders: [writesGreet],
  task: async (c, { key: name }) => {
    await c.send(`Add a ${name} button.`)
    const build = await c.exec(`test ${name} != double`)
    if (build.exitCode !== 0) {
      throw new EvalError({ reason: 'the build fails', meta: { button: name, exitCode: 1 } })
    }
  },
})
