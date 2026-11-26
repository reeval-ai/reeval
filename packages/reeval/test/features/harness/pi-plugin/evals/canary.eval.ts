import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { house } from './env.ts'

// Must fail: the release code is written by the agent following the unpacked command, not by
// reeval.
export default defineEval({
  environment: house,
  graders: [hasFile('release.txt', /^KESTREL-19\s*$/)],
  task: async (c) => {
    await c.exec('true')
  },
})
