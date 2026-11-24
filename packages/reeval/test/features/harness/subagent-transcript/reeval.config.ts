import { defineConfig } from 'reeval'
import { fakeHarness } from 'reeval/harness'

const usage = (input: number, output: number) => ({
  input,
  output,
  cacheRead: 0,
  cacheWrite: 0,
  reasoning: 0,
})

// REEVAL_FIXTURE_SANDBOX picks the tier: the fake sandbox (F) by default, or docker (D).
// The agent's own calls are 100 in and 10 out; it hands one file to a subagent whose events
// stream (40 in, 4 out) and another to one whose events don't (20 in, 2 out).
export default defineConfig({
  harnesses: fakeHarness({
    usage: usage(100, 10),
    subagents: [
      {
        prompt: 'write add.js',
        agent: 'general-purpose',
        files: { 'add.js': 'export const add = (a, b) => a + b\n' },
        text: 'Wrote add.js.',
        usage: { input: 40, output: 4 },
      },
      {
        prompt: 'write mul.js',
        files: { 'mul.js': 'export const mul = (a, b) => a * b\n' },
        text: 'Wrote mul.js.',
        events: 'none',
        usage: { input: 20, output: 2 },
      },
    ],
  }),
})
