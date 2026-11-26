import { defineEval, defineGrader } from 'reeval'
import { hasFile, notInDiff, succeeded } from 'reeval/graders'
import { channels, PREAMBLE, project } from './channels.ts'
import { runOnFake } from './checks.ts'

const source = 'evals/slug.eval.ts'

const task =
  PREAMBLE +
  'The last `npx reeval run` failed; its results are in .reeval/. Use reeval to find which ' +
  'grader failed and why before you change anything. The fake agent in reeval.config.ts is ' +
  'right, so fix the eval, not the config, and keep every grader. Rerun until it passes, then ' +
  'tell me the name of the grader that failed.'

const failing = project('slug', 'debug', ['./node_modules/.bin/reeval run --ui plain || true'])

export default defineEval({
  compare: channels(failing),
  graders: [
    succeeded('passes-on-the-fake-config'),
    notInDiff('reeval.config.ts', { name: 'leaves-the-config-alone' }),
    hasFile(source, /trims punctuation/, { name: 'keeps-the-grader' }),
    hasFile(source, /ahoy-ada/, { name: 'expects-a-single-hyphen' }),
    defineGrader('names-the-failed-grader', {
      grade: (c) => /trims punctuation/.test(c.turns.at(-1)?.text ?? ''),
    }),
  ],
  task: async (c) => {
    await c.send(task)
    await runOnFake(c)
  },
})
