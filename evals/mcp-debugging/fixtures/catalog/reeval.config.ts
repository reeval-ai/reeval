import { join } from 'node:path'
import { defineConfig, regression } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeJudge } from 'reeval/judge'
import { fakeSandbox } from 'reeval/sandbox'

const write = JSON.stringify(join(import.meta.dirname, 'agent/write.mjs'))

// What a chatty agent says when it's done: every attempt ends with a long summary.
const summary = Array.from(
  { length: 12 },
  (_, i) =>
    `${i + 1}. Reviewed the module's exports, kept the public API stable, added a short doc comment and checked the edge cases (empty input, unicode, very long strings) by hand.`,
).join('\n')

export default defineConfig({
  agents: fakeAgent({ script: [[{ exec: `node ${write}` }]], text: `Done.\n\n${summary}` }),
  sandbox: fakeSandbox(),
  target: regression(),
  judge: { model: fakeJudge({ score: 0.9 }) },
})
