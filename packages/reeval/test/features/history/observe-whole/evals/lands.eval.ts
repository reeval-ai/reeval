import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { plain } from './env.ts'
import { observeLog } from './observe.ts'

// An observation of any size is kept whole, with the sha256 of its masked JSON.
export default defineEval({
  environment: plain,
  graders: [observed<string>('build-log', (log) => log.split('\n').length === 4001)],
  task: observeLog,
})
