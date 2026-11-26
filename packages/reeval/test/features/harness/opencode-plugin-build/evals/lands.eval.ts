import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { built } from './env.ts'

// Under OpenCode's layout, a built plugin's subagent is unpacked from the build's output, not from
// the source the plan read, with its frontmatter cut to what OpenCode takes.
export default defineEval({
  environment: built,
  graders: [
    hasFile(
      '.opencode/agents/reviewer.md',
      /^---\ndescription: Reviews a change\.\nmode: subagent\n---\n\nBUILT-58\n$/,
    ),
  ],
  task: async (c) => {
    await c.exec('true')
  },
})
