import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { plain } from './env.ts'
import { observeLog } from './observe.ts'

export default defineEval({
  environment: plain,
  // The mistake: the build logged 4000 steps, not 4.
  graders: [observed<string>('build-log', (log) => log.split('\n').length === 5)],
  task: observeLog,
})
