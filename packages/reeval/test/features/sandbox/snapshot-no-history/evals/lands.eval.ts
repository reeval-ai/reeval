import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { agentSaw, seeded } from './env.ts'

// c.send -> c.writeFile -> c.send: a placement between turns leaves one parentless commit and
// prunes the seeded file's pre-seed content and the object turn 1's diff capture wrote for it, so
// the agent finds neither. Turn 1's edit to another file stays in the final diff.
export default defineEval({
  environment: seeded,
  graders: [
    observed('probe', (probe) => probe === 'pre-seed content in: nowhere'),
    observed<string[]>(
      'diff',
      (diff) => JSON.stringify(diff) === JSON.stringify(['added notes.txt']),
    ),
  ],
  task: async (c) => {
    await c.send('Make a change.')
    await c.writeFile('src/sum.js', 'export const sum = (a, b) => a - b\n')
    const t2 = await c.send('Report.')
    const [probe] = agentSaw(t2)
    c.observe('probe', probe?.trim() ?? null)
    c.observe('diff', t2.diff.files.map((f) => `${f.status} ${f.path}`).sort())
  },
})
