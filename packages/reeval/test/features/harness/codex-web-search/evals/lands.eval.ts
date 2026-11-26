import { defineEval } from 'reeval'
import { searched } from 'reeval/graders'
import { closed, completed, prompt } from './env.ts'

// Under deny-all, the agent searched with its web tool and the transcript has the search and its
// query. Codex leaves a search the gateway refused out of its stream, and the model names the
// repository from memory either way, so the search event is the check.
export default defineEval({
  environment: closed,
  graders: [completed, searched(/codex/i)],
  task: async (c) => {
    await c.send(prompt)
  },
})
