import { defineEval } from 'reeval'
import { searched } from 'reeval/graders'
import { closed, completed, prompt, succeededSearch } from './env.ts'

// Under deny-all, the agent searched with its web tool and the search succeeded: a search the
// gateway refused is still a web-search event, with ok false.
export default defineEval({
  environment: closed,
  graders: [completed, searched(/antigravity/i), succeededSearch],
  task: async (c) => {
    await c.send(prompt)
  },
})
