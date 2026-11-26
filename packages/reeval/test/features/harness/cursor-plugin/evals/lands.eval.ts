import { defineEval, defineGrader } from 'reeval'
import { execOf } from 'reeval/graders/match'
import { hookRan, house, prompt } from './env.ts'

const unpacked = defineGrader('unpacked', {
  files: [
    'codeword.txt',
    '.cursor/hooks.json',
    '.cursor/rules/house-codeword.mdc',
    '.cursor/agents/reviewer.md',
    '.cursor/commands/ship.md',
  ],
  grade: async (c) => ({
    codeword: (await c.readFile('codeword.txt'))?.trim() ?? null,
    hookRan: execOf(c, hookRan)?.stdout.trim() ?? null,
    hooks: JSON.parse((await c.readFile('.cursor/hooks.json')) ?? '{}'),
    rule: await c.readFile('.cursor/rules/house-codeword.mdc'),
    agent: await c.readFile('.cursor/agents/reviewer.md'),
    command: await c.readFile('.cursor/commands/ship.md'),
  }),
  score: (g) => {
    const start = g.hooks.hooks?.sessionStart
    return g.codeword === 'SAFFRON-73' &&
      g.hookRan === 'house-hook-ran' &&
      g.hooks.version === 1 &&
      Object.keys(g.hooks.hooks ?? {}).join() === 'sessionStart' &&
      start?.length === 1 &&
      start[0].type === 'command' &&
      /^cp "([^"]+\/\.reeval\/plugins\/house)\/marker\.txt" "\1\/hook-ran\.txt"$/.test(
        start[0].command,
      ) &&
      /^---\nalwaysApply: true\n---\n\n# House codeword\n/.test(g.rule ?? '') &&
      g.agent?.includes('name: reviewer') &&
      g.command?.includes('SHIPPED')
      ? 1
      : 0
  },
})

// Under Cursor's layout, reeval unpacks the plugin's rule, subagent, command and hooks into the
// workspace's .cursor/ before the snapshot: the agent follows the rule, and its session ran the
// hook, with ${CLAUDE_PLUGIN_ROOT} filled in with where the plugin was copied.
export default defineEval({
  environment: house,
  graders: [unpacked],
  task: async (c) => {
    await c.send(prompt)
    await c.exec(hookRan)
  },
})
