import { defineEval } from 'reeval'
import { executables, modes, prints } from './env.ts'

// Must fail: only the executable bit is kept, so notes.txt isn't made executable.
export default defineEval({
  environment: executables,
  graders: [prints('all-executable', modes, 'bin/run.sh x\nnotes.txt x\n')],
  task: async (c) => {
    await c.exec(modes)
  },
})
