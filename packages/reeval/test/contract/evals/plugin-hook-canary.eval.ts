import { defineEval, expect } from 'reeval'
import { closed, PLUGIN_HOOK_MARKER, trimmed } from './probes.ts'

// The probe plugin's SessionStart hook ran: only it writes the marker. Tagged plugin-hooks too, so
// a harness that loads plugins but not their hooks leaves these out.
const tags = ['plugin', 'plugin-hooks']

// Must fail: without the plugin, no hook writes the marker.
export default defineEval({
  environment: closed,
  tags,
  task: async (c) => {
    expect(await trimmed(c.readFile, PLUGIN_HOOK_MARKER)).toBe('hook-ran')
  },
})
