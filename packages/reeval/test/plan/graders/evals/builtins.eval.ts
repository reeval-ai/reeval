import { defineEval, defineGrader } from 'reeval'
import { calledTool, hasFile, notInDiff, turns, usedSkill } from 'reeval/graders'

const builds = defineGrader('builds', { grade: () => true })

export default defineEval({
  graders: [
    usedSkill('http-retries', { weight: 2, required: true }),
    calledTool('Bash', { command: /npm test/ }, { score: (n) => Math.min(n, 3) / 3 }),
    hasFile('src/retry.ts', /export function retry/),
    notInDiff('test/**', { weight: 0 }),
    // Replaces the config's turns.
    turns({ required: true, score: (n) => (n <= 3 ? 1 : 0) }),
    builds,
  ],
  task: async () => {},
})
