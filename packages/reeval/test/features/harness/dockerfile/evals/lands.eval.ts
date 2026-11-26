import { defineEval, defineGrader } from 'reeval'
import { execOf } from 'reeval/graders/match'
import { harnessCli } from '../layout.ts'
import { plain } from './env.ts'

const cli = defineGrader('harness-cli', {
  grade: (c) => ({
    found: execOf(c, 'find')?.stdout.trim() ?? null,
    version: execOf(c, 'version')?.stdout.trim() ?? null,
  }),
  score: ({ found, version }) =>
    new RegExp(`/${harnessCli.name}$`).test(found ?? '') &&
    (!harnessCli.version || harnessCli.version.test(version ?? ''))
      ? 1
      : 0,
})

// A Dockerfile FROM ${REEVAL_BASE} is built on the harness's image, so its CLI is there.
export default defineEval({
  environment: plain,
  graders: [cli],
  task: async (c) => {
    const found = await c.exec(harnessCli.find, { label: 'find' })
    if (!harnessCli.version) return
    await c.exec(`'${found.stdout.trim()}' --version`, { label: 'version' })
  },
})
