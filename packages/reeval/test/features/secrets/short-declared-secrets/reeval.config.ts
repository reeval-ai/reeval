import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'

// As the agent: print both secrets, and add a file of 1234 lines, so the transcript has a
// `"added": 1234` beside the `null`s every record has.
export default defineConfig({
  target: regression(),
  agents: fakeAgent({
    script: [[{ exec: 'printf "%s\\n" "$PIN" "$PLACEHOLDER"' }]],
    files: { 'pins.txt': 'pin\n'.repeat(1234) },
  }),
})
