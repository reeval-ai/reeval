// Results: one eval per outcome against its target: a pass, an EvalError with its meta, a mean
// score under its threshold with a judge grader, a throw on a target that doesn't block, an infra
// error, and two skipped evals (one `skip: 'todo'`).
import { defineEval } from 'reeval'

export default defineEval({ skip: 'todo', task: async () => {} })
