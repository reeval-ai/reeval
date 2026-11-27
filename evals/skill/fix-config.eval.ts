import { defineEval, defineGrader } from 'reeval'
import { notInDiff, succeeded } from 'reeval/graders'
import { channels, PREAMBLE, project } from './channels.ts'
import { dryRun, planOf, runOnFake } from './checks.ts'

const task =
  PREAMBLE +
  '`npx reeval run --dry-run` fails. Fix reeval.config.ts and the evals so the plan is what ' +
  'the author meant: the docs eval compares no docs (the baseline) against the with-docs ' +
  'environment, 3 trials per cell, and `npx reeval run` passes. Leave docs/ alone. Then list ' +
  'each mistake you fixed, one line each.'

export default defineEval({
  compare: channels(project('notes', 'fix-config')),
  graders: [
    succeeded('dry-run', { name: 'reeval-run-dry-run-exits-0' }),
    defineGrader('plans-2-cells-and-6-trials', {
      grade: (c) => {
        const totals = planOf(c)?.totals
        return totals?.evals === 1 && totals.cells === 2 && totals.trials === 6
      },
    }),
    defineGrader('with-docs-is-the-variant', {
      grade: (c) =>
        planOf(c)?.evals[0]?.cells.find((cell) => cell.role === 'variant')?.environment ===
        'with-docs',
    }),
    succeeded('passes-on-the-fake-config'),
    notInDiff('docs/**', { name: 'leaves-docs-alone' }),
    defineGrader('names-the-judge-inputs', {
      grade: (c) => /inputs/i.test(c.turns.at(-1)?.text ?? ''),
    }),
  ],
  task: async (c) => {
    await c.send(task)
    await dryRun(c)
    await runOnFake(c)
  },
})
