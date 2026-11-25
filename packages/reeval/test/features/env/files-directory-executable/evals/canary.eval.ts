import { defineEval, expect } from 'reeval'
import { executables, modes } from './env.ts'

// Must fail: only the executable bit is kept, so notes.txt isn't made executable.
export default defineEval({
  environment: executables,
  task: async (c) => {
    expect((await c.exec(modes)).stdout).toBe('bin/run.sh x\nnotes.txt x\n')
  },
})
