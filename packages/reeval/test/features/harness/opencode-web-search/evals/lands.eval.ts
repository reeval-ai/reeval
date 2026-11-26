import { defineEval } from 'reeval'
import { searched } from 'reeval/graders'
import { closed, completed, found, prompt } from './env.ts'

// Under deny-all, the agent searched with its web tool and the search came back with results:
// the trajectory has the search, its query and how many pages it found.
export default defineEval({
  environment: closed,
  graders: [completed, searched(/opencode/i), found],
  task: async (c) => {
    await c.send(prompt)
  },
})
