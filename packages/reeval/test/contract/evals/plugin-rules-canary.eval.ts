import { defineEval, expect } from 'reeval'
import { closed, PLUGIN_RULES_WORD, trimmed } from './probes.ts'

// The probe plugin's rule is read: the codeword it writes is only in the rule. Tagged plugin-rules
// too, so a harness that loads plugins but not their rules leaves these out.
const tags = ['plugin', 'plugin-rules']

// Must fail: without the plugin and with no turn, nothing has written the codeword.
export default defineEval({
  environment: closed,
  tags,
  task: async (c) => {
    expect(await trimmed(c.readFile, 'plugin-codeword.txt')).toBe(PLUGIN_RULES_WORD)
  },
})
