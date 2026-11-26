import { isDeepStrictEqual } from 'node:util'
import { defineEval, defineGrader } from 'reeval'
import { house, loaded, shellOutput } from './env.ts'

const enabled = defineGrader('enabled-from-marketplace', {
  grade: (c) => {
    const turn = c.turns[0]
    const settings = JSON.parse(shellOutput(turn, 0) ?? '{}')
    return {
      enabledPlugins: settings.enabledPlugins ?? null,
      env: settings.env ?? null,
      source: settings.extraKnownMarketplaces?.reeval?.source?.source ?? null,
      marketplace: shellOutput(turn, 1) ?? null,
      skill: shellOutput(turn, 2) ?? null,
      loaded: loaded(turn),
      docs: JSON.parse(shellOutput(turn, 3) ?? '{}').mcpServers?.docs?.args ?? null,
    }
  },
  score: (g) =>
    isDeepStrictEqual(g.enabledPlugins, { 'other@elsewhere': false, 'house@reeval': true }) &&
    isDeepStrictEqual(g.env, { HOUSE: '1' }) &&
    g.source === 'directory' &&
    g.marketplace?.includes('"source": "./house"') &&
    g.skill?.includes('Write every name in kebab-case.') &&
    !g.loaded.includes('house:docs') &&
    // The placed plugin's server goes through reeval's MCP timer, at its placed stamp.mjs.
    isDeepStrictEqual(g.docs?.slice(1, 4), ['--name', 'house:docs', '--']) &&
    /\/\.reeval\/plugins\/house\/stamp\.mjs$/.test(g.docs?.at(-1) ?? '')
      ? 1
      : 0,
})

// Under Claude Code's layout, the plugin is enabled from a directory marketplace in
// ~/.claude/settings.json, beside the settings the environment wrote there, and its MCP server is
// left to Claude Code, not the agent's MCP config.
export default defineEval({
  environment: house,
  graders: [enabled],
  task: async (c) => {
    await c.send('read the plugin settings')
  },
})
