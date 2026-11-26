import { defineEval } from 'reeval'
import { plain } from './env.ts'
import { readsBuild, runExecs } from './execs.ts'

// The record keeps each c.exec in order, with its label, output and the turn it came after.
export default defineEval({
  environment: plain,
  graders: [readsBuild('stdout')],
  task: runExecs,
})
