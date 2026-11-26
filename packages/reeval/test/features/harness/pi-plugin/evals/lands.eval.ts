import { defineEval, defineGrader } from 'reeval'
import { house, loaded, shellOutput } from './env.ts'

const unpacked = defineGrader('unpacked', {
  files: ['release.txt', '.pi/prompts/ship.md'],
  grade: async (c) => ({
    skill: shellOutput(c.turns[0], 0) ?? null,
    loaded: loaded(c.turns[0]),
    release: (await c.readFile('release.txt'))?.trim() ?? null,
    prompt: await c.readFile('.pi/prompts/ship.md'),
  }),
  score: (g) =>
    g.skill?.includes('Write every name in kebab-case.') &&
    g.loaded.includes('mcp: house:docs') &&
    g.release === 'KESTREL-19' &&
    g.prompt?.includes("argument-hint: '[branch]'")
      ? 1
      : 0,
})

// Under pi's layout, the plugin's skill joins pi's home skills and its MCP server its mcp.json, as
// house:docs; its command is unpacked as one of the workspace's prompt templates before the
// snapshot, as it is (pi reads Claude Code's description and argument-hint).
export default defineEval({
  environment: house,
  graders: [unpacked],
  task: async (c) => {
    await c.send('/ship main')
  },
})
