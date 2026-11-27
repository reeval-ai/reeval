// Results: one eval per outcome against its target: a pass, an EvalError with its meta, a mean
// score under its threshold with a judge grader, a throw on a target that doesn't block, an infra
// error, and two skipped evals (one `skip: 'todo'`).
import { defineEval, defineGrader, regression } from 'reeval'
import { namesTheCause, writesGreet } from './graders.ts'

const rootCause = defineGrader('names-the-root-cause', {
  grade: (c) => String(c.observation('answer')).includes('null'),
})

export default defineEval({
  runs: 2,
  target: regression(0.8),
  graders: [writesGreet, rootCause, namesTheCause],
  task: async (c) => {
    await c.send('Why does greet.js fail?')
    c.observe('answer', c.attempt.n === 1 ? 'the name is null' : 'Docker is down')
  },
})
