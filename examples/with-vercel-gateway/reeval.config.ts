import { readFileSync } from 'node:fs'
import { defineConfig } from 'reeval'
import { claudeCode, fakeAgent } from 'reeval/agent'
import { vercel } from 'reeval/gateway'
import { fakeJudge } from 'reeval/judge'
import { docker, fakeSandbox } from 'reeval/sandbox'
import { profiles } from '../profiles.ts'

const fakeFile = (path: string) =>
  readFileSync(new URL(`./fake-agent/${path}`, import.meta.url), 'utf8')

export default defineConfig({
  include: ['*.eval.ts'],
  // A scripted agent that copies ./fake-agent's files into the workspace, so the graders run
  // without keys or Docker.
  agents: fakeAgent({
    files: {
      'src/math.js': fakeFile('src/math.js'),
      'test/math.test.js': fakeFile('test/math.test.js'),
    },
    text: 'I added multiply(a, b) to src/math.js and a test for it.',
  }),
  sandbox: fakeSandbox(),
  // A fixed score and no model call; each profile sets its own judge model, which wins.
  judge: { model: fakeJudge({ score: 0.9 }) },
  profiles: {
    // The real agents: `--profile claude-code`, or any other in ../profiles.ts. An example's own
    // profiles go beside them.
    ...profiles,
    // Claude Code and its judge on one key, AI_GATEWAY_API_KEY. With vercel() alone in the list,
    // a model Vercel can't serve stops the plan instead of falling back to its own key. On
    // Vercel, Jev is the judge that answers: its other models are language models, not
    // decision models.
    vercel: {
      defaults: { agents: claudeCode({ model: 'claude-sonnet-5' }), sandbox: docker() },
      judge: { model: 'typesafe-ai/jev-1.14.0' },
      gateway: [vercel()],
    },
  },
})
