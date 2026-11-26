import { defineEval, defineGrader } from 'reeval'
import { house, loaded, shellOutput } from './env.ts'

const unpacked = defineGrader('unpacked', {
  files: ['review.txt', '.opencode/agents/reviewer.md', '.opencode/commands/ship.md'],
  grade: async (c) => ({
    skill: shellOutput(c.turns[0], 0) ?? null,
    loaded: loaded(c.turns[0]),
    review: (await c.readFile('review.txt'))?.trim() ?? null,
    agent: await c.readFile('.opencode/agents/reviewer.md'),
    command: await c.readFile('.opencode/commands/ship.md'),
  }),
  score: (g) =>
    g.skill?.includes('Write every name in kebab-case.') &&
    g.loaded.includes('mcp: house:docs') &&
    g.review === 'HERON-62' &&
    g.agent ===
      '---\ndescription: Reviews a change against the house style. Use when asked for a house review.\nmode: subagent\n---\n\nReview the change against the house style. The review code is HERON-62.\n' &&
    g.command ===
      '---\ndescription: Ship the change the house way\n---\n\nCheck the house style, then reply with the single word SHIPPED.\n'
      ? 1
      : 0,
})

// Under OpenCode's layout, the plugin's skill joins OpenCode's home skills and its MCP server its
// config, as house:docs; its subagent and command are unpacked into the workspace's .opencode/
// before the snapshot, with only the frontmatter OpenCode's schema takes.
export default defineEval({
  environment: house,
  graders: [unpacked],
  task: async (c) => {
    await c.send('review the change')
  },
})
