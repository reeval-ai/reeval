import { defineEval, defineGrader, defineGraders } from 'reeval'
import { setUp, shared, sourcesOf, target } from './setup.ts'

export default defineEval({
  ...target('empty'),
  graders: [
    ...shared,
    defineGrader('researches-tailwind-v4-first', {
      grade: (c) =>
        (c.turns.at(-1)?.transcript ?? []).filter(
          (e) =>
            e.type === 'web-search' ||
            e.type === 'web-fetch' ||
            (e.type === 'tool' && /\b(curl|wget|npm (view|info))\b/.test(JSON.stringify(e.input))),
        ).length,
      score: (n) => (n > 0 ? 1 : 0),
    }),
    defineGraders(['evals-about-tailwind', 'checks-v4-css-import'], {
      grade: sourcesOf,
      score: {
        'evals-about-tailwind': (s) => (/tailwind/i.test(s) ? 1 : 0),
        'checks-v4-css-import': (s) => (/@import/.test(s) ? 1 : 0),
      },
    }),
  ],
  task: async (c) => {
    await setUp(
      c,
      "I'd like to know whether coding agents set up Tailwind CSS v4 correctly in a new project.",
    )
  },
})
