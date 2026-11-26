import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { plain } from './env.ts'
import { observeInstall } from './observe.ts'

// The observations are data: the record keeps each name's last value and the turn it came after.
export default defineEval({
  environment: plain,
  graders: [observed<string[]>('deps', (deps) => deps.includes('drizzle-orm'))],
  task: observeInstall,
})
