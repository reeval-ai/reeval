import { defineEval, expect } from 'reeval'
import { PLUGIN_RULES_WORD, plugged, prompts, trimmed, withFakePlugin } from './probes.ts'

// The probe plugin's rule is read: the codeword it writes is only in the rule. Tagged plugin-rules
// too, so a harness that loads plugins but not their rules leaves these out.
const tags = ['plugin', 'plugin-rules']

export default defineEval({
  environment: plugged,
  agents: withFakePlugin,
  tags,
  task: async (c) => {
    await c.send(prompts.pluginRules)
    expect(await trimmed(c.readFile, 'plugin-codeword.txt')).toBe(PLUGIN_RULES_WORD)
  },
})
