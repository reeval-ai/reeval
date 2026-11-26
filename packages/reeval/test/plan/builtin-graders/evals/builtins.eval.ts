import { defineEval } from 'reeval'
import { hasFile, notInDiff, succeeded, turns, usedSkill } from 'reeval/graders'

export default defineEval({
  graders: [
    hasFile('src/retry.ts', /export function retry/m),
    succeeded('node --test', { name: 'tests-pass', required: true }),
    usedSkill('http-retries', { weight: 2 }),
    notInDiff('test/**', { weight: 0 }),
    turns(),
  ],
  task: async () => {},
})
