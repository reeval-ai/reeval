// Results: one eval per outcome against its target: a pass, an EvalError with its meta, a mean
// score under its threshold with a judge grader, a throw on a target that doesn't block, an infra
// error, and two skipped evals (one `skip: 'todo'`).
// biome-ignore lint/suspicious/noShadowRestrictedNames: reeval's EvalError stands in for the global one
import { defineEval, EvalError, regression } from 'reeval'
import { writesGreet } from './graders.ts'

export default defineEval({
  target: regression(),
  graders: [writesGreet],
  task: async (c) => {
    await c.send('Write greet.js that greets in French.')
    const grep = await c.exec('grep -q Bonjour greet.js')
    if (grep.exitCode !== 0) {
      throw new EvalError({
        reason: 'greet.js has no French greeting',
        meta: { file: 'greet.js', exitCode: grep.exitCode },
      })
    }
  },
})
