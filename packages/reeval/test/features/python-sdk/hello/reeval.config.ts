import { defineConfig, regression } from 'reeval'
import { cursor, fakeAgent } from 'reeval/agent'
import { fakeJudge } from 'reeval/judge'
import { docker, fakeSandbox } from 'reeval/sandbox'

// REEVAL_FIXTURE_SANDBOX picks fake (F) or docker (D). REEVAL_FIXTURE_HARNESS=cursor is real Cursor (C).
const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('./sandboxes', import.meta.url) })

export default defineConfig({
  target: regression(),
  include: ['evals/**/*.eval.py'],
  agents:
    process.env.REEVAL_FIXTURE_HARNESS === 'cursor'
      ? cursor({
          model: process.env.REEVAL_REAL_MODEL ?? 'composer-2.5',
          params: { fast: 'false' },
        })
      : fakeAgent({
          script: [[{ write: { 'greet.py': 'print("hi")\n' } }, { reply: 'Created greet.py.' }]],
        }),
  sandbox,
  judge:
    process.env.REEVAL_FIXTURE_JUDGE === 'real'
      ? { model: 'google/gemini-3.8-flash', threshold: 0.8 }
      : { model: fakeJudge({ score: 1 }) },
})
