import { defineEval } from 'reeval'
import { own, probedLines, prompt, readLog } from './env.ts'

const evalWord = probedLines('eval-word', (lines) => lines.includes('word=HERON-41'))

// Must fail: the server's own PROBE_WORD wins over the eval's.
export default defineEval({
  environment: own,
  graders: [evalWord],
  task: async (c) => {
    await c.send(prompt)
    await c.exec(readLog)
  },
})
