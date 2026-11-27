import { isDeepStrictEqual } from 'node:util'
import { defineEval } from 'reeval'
import { closed, prompt, VARS, varsSeen } from './env.ts'

const evalValues = varsSeen('eval-values', (vars) =>
  isDeepStrictEqual(
    vars,
    Object.entries(VARS)
      .map(([name, value]) => `${name}=${value}`)
      .sort(),
  ),
)

// The agent's shell has the eval's values, not the empty ones of a route the trial isn't on.
export default defineEval({
  environment: closed,
  graders: [evalValues],
  task: async (c) => {
    await c.send(prompt)
  },
})
