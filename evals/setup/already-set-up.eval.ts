import { defineEval, defineGrader } from 'reeval'
import { notInDiff } from 'reeval/graders'
import { evalList, names, planOf, setUp, shared, target } from './setup.ts'

export default defineEval({
  ...target('firebase-set-up'),
  graders: [
    ...shared,
    defineGrader('keeps-the-existing-eval', {
      grade: (c) => planOf(c)?.evals.map((e) => e.name) ?? [],
      score: (evals) => (evals.includes('greet') ? 1 : 0),
    }),
    notInDiff('evals/greet.eval.ts'),
    defineGrader('keeps-environments-ts', {
      files: ['evals/environments.ts'],
      grade: async (c) => {
        const now = await c.readFile('evals/environments.ts').catch(() => '')
        return now.includes(String(c.observation('environments')).trim())
      },
    }),
    notInDiff(['skills/**', 'README.md']),
  ],
  task: async (c) => {
    const before = names(await evalList(c))
    c.observe('environments', (await c.readFile('evals/environments.ts')) ?? '')
    await setUp(c, 'Yes, go ahead.', before)
  },
})
