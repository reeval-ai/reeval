import { defineGrader, defineGraders } from 'reeval'

// One grade call that two graders score: builds is 3 parts of the score, tests 1.
export const [builds, tests] = defineGraders(['builds', 'tests'], {
  grade: () => ({ built: true, passed: 0 }),
  score: { builds: (g) => (g.built ? 1 : 0), tests: (g) => g.passed / 2 },
  weight: { builds: 3 },
})

// Weight 0 records only, and so does a grade with no score.
export const ignored = defineGrader('ignored', { grade: () => false, weight: 0 })
export const note = defineGrader('note', { grade: (c) => c.turns[0]?.text ?? '' })

export const strict = defineGrader('strict', {
  grade: () => 1,
  score: (n) => n / 2,
  required: true,
})
