import { defineEval } from 'reeval'
import { closed, prompt, varsSeen } from './env.ts'

const noProject = varsSeen('no-project', (vars) => !vars.includes('GCP_PROJECT_ID=eval-project'))

// Must fail: the agent's shell has the eval's project.
export default defineEval({
  environment: closed,
  graders: [noProject],
  task: async (c) => {
    await c.send(prompt)
  },
})
