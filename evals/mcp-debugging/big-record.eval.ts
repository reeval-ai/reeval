import { defineEval } from 'reeval'
import { fixesARun, fixesTheExport, fixTask, study } from './debugging.ts'

export default defineEval({
  ...study('big-record', { base: 'catalog' }),
  graders: fixesTheExport,
  task: fixesARun(`${fixTask}\n\nIts runs are large: 82 attempts each.`),
})
