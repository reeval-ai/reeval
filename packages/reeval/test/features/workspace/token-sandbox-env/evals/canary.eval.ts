import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { privateRepo } from './env.ts'

const token = process.env.REEVAL_FIXTURE_GIT_TOKEN as string

// Must fail: the sandbox's processes don't have the token.
export default defineEval({
  environment: privateRepo,
  graders: [observed('token-in-sandbox', (found) => found === true)],
  task: async (c) => {
    const r = await c.exec('env; cat /proc/*/environ 2>/dev/null | tr "\\0" "\\n"')
    c.observe('token-in-sandbox', r.stdout.includes(token))
  },
})
