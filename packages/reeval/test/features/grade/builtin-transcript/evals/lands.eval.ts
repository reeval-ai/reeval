import { defineEval } from 'reeval'
import { calledMcp, calledTool, ran, usedSkill, wrote } from 'reeval/graders'
import { skilled } from './env.ts'

// The transcript's built-ins: skills, tools, MCP calls, commands and edits.
export default defineEval({
  environment: skilled,
  graders: [
    usedSkill('foo', { required: true }),
    usedSkill(),
    calledTool('Read', { path: 'README.md' }),
    calledMcp('docs', 'search', { weight: 0.5 }),
    ran(/echo built/),
    wrote('src/client.ts'),
  ],
  task: async (c) => {
    await c.send('use the foo skill')
  },
})
