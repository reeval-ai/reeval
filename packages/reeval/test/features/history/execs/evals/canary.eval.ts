import { defineEval } from 'reeval'
import { plain } from './env.ts'
import { readsBuild, runExecs } from './execs.ts'

export default defineEval({
  environment: plain,
  // The mistake: the build went to stdout, not stderr.
  graders: [readsBuild('stderr')],
  task: runExecs,
})
