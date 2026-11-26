// Results: one eval per outcome against its target: a pass, an EvalError with its meta, a mean
// score under its threshold with a judge grader, a throw on a target that doesn't block, an infra
// error, and two skipped evals (one `skip: 'todo'`).
import { defineEval, regression } from 'reeval'
import { writesGreet } from './graders.ts'

export default defineEval({
  target: regression(),
  graders: [writesGreet],
  task: async (c) => void (await c.send('Write greet.js.')),
})
