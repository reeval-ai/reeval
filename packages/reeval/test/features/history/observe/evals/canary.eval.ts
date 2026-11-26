import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { plain } from './env.ts'
import { observeInstall } from './observe.ts'

export default defineEval({
  environment: plain,
  // The mistake: the agent installed drizzle-orm, not prisma.
  graders: [observed<string[]>('deps', (deps) => deps.includes('prisma'))],
  task: observeInstall,
})
