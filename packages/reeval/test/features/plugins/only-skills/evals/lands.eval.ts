import { defineEval } from 'reeval'
import { observed } from 'reeval/graders'
import { review, skill } from './env.ts'

// only: ['skills'] places the plugin's skill where the agent reads its home skills.
export default defineEval({
  environment: review,
  graders: [observed<string>('SKILL.md', (text) => text.includes('Run `npm run lint`'))],
  task: async (c) => {
    await c.send('Lint the change.')
    c.observe('SKILL.md', (await c.exec(`cat ${skill}`)).stdout)
  },
})
