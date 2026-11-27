import { defineEval, defineGrader } from 'reeval'
import { hasFile, succeeded } from 'reeval/graders'
import { channels, PREAMBLE, project } from './channels.ts'
import { dryRun, planOf, typecheck } from './checks.ts'

const source = 'evals/landing.eval.ts'

const task =
  PREAMBLE +
  'evals/landing.eval.ts builds a landing page and screenshots it as `home`. Turn it into a ' +
  'skill comparison: the baseline has no skill, the variant gets the design skill in ' +
  "skills/design, 2 trials per cell. Add a question asking which environment's landing page follows " +
  "the design guidelines more closely, and let the question see each side's `home` " +
  'screenshot. Keep the existing grader. `npx reeval run --dry-run` must plan it and it must ' +
  "typecheck with `npx tsc -p .`; you don't need to run it."

const question = (c: Parameters<typeof planOf>[0]) => planOf(c)?.evals[0]?.questions[0]

export default defineEval({
  compare: channels(project('landing', 'compare')),
  graders: [
    succeeded('typechecks'),
    defineGrader('plans-2-cells-and-4-trials', {
      grade: (c) => {
        const totals = planOf(c)?.totals
        return totals?.evals === 1 && totals.cells === 2 && totals.trials === 4
      },
    }),
    defineGrader('a-baseline-and-a-variant', {
      grade: (c) =>
        planOf(c)
          ?.evals[0]?.cells.map((cell) => cell.role)
          .sort()
          .join() === 'baseline,variant',
    }),
    defineGrader('asks-a-compare-question', {
      grade: (c) => /design/i.test(question(c)?.question ?? ''),
    }),
    defineGrader('pairs-the-two-environments', {
      grade: (c) => question(c)?.across.includes('environment') ?? false,
    }),
    defineGrader('the-question-sees-screenshots', {
      grade: (c) => question(c)?.shows.includes('artifacts') ?? false,
    }),
    hasFile(source, /artifacts:\s*(\[\s*['"`]home['"`]|true)/, { name: 'the-home-screenshot' }),
    hasFile(source, /capture\(/, { name: 'keeps-the-capture' }),
    hasFile(source, /skills\/design/, { name: 'uses-the-design-skill' }),
  ],
  task: async (c) => {
    await c.send(task)
    await typecheck(c)
    await dryRun(c)
  },
})
