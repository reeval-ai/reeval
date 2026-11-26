import { defineGrader } from 'reeval'
export const says = defineGrader('says', {
  files: ['out.txt'],
  grade: async (c) => (await c.readFile('out.txt')) === 'goodbye',
})
export const key = defineGrader('key', { grade: (c) => c.case.key, weight: 0 })
export const quality = defineGrader('quality', {
  judge: { question: 'Is the reply clear?', inputs: { output: true } },
  score: { true: 1, false: 0.5 },
})
