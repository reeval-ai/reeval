import assert from 'node:assert/strict'
import { defineEval } from 'reeval'
import { PLUGIN_HOOK_MARKER, plugged, prompts, trimmed, withFakePlugin } from './probes.ts'

// The probe plugin's SessionStart hook ran: only it writes the marker. Tagged plugin-hooks too, so
// a harness that loads plugins but not their hooks leaves these out.
const tags = ['plugin', 'plugin-hooks']

export default defineEval({
  environment: plugged,
  agents: withFakePlugin,
  tags,
  task: async (c) => {
    await c.send(prompts.pluginHook)
    assert.equal(await trimmed(c.readFile, PLUGIN_HOOK_MARKER), 'hook-ran')
  },
})
