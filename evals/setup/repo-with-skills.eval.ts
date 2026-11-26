import { defineEval, defineGrader } from 'reeval'
import { notInDiff } from 'reeval/graders'
import { planOf, setUp, shared, target } from './setup.ts'

export default defineEval({
  ...target('supabase'),
  graders: [
    ...shared,
    defineGrader('compares-a-skill', {
      grade: (c) => planOf(c)?.evals.flatMap((e) => e.roles) ?? [],
      score: (roles) => (roles.includes('variant') ? 1 : 0),
    }),
    notInDiff(['skills/**', 'README.md', 'AGENTS.md', 'test/**']),
  ],
  task: async (c) => {
    await setUp(c, 'Yes, go ahead.')
  },
})
