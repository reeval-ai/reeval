import { defineEval } from 'reeval'
import { executables, modes, prints } from './env.ts'

// A file its owner may execute on the host is executable in the sandbox; others aren't.
export default defineEval({
  environment: executables,
  graders: [prints('modes', modes, 'bin/run.sh x\nnotes.txt -\n')],
  task: async (c) => {
    await c.exec(modes)
  },
})
