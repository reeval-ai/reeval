import { defineGrader } from 'reeval'

// Reads the kept workspace, within its files.
export const answers = (answer: number) =>
  defineGrader(`answers-${answer}`, {
    files: ['src/**'],
    grade: async (c) => (await c.readFile('src/app.js')).includes(`answer = ${answer}`),
  })

// The kept workspace is masked: the agent's .env holds a token, which no grader sees.
export const masked = defineGrader('masked', {
  files: ['.env'],
  grade: async (c) => !(await c.readFile('.env')).includes('ghp_'),
})

export const observed = defineGrader('observed', {
  grade: (c) => c.observation('lines'),
  score: (lines) => (lines === 1 ? 1 : 0),
})

export const ran = defineGrader('ran', {
  grade: (c) => c.execs.find((e) => e.label === 'app')?.stdout ?? '',
  score: (out) => (out.includes('42') ? 1 : 0),
})

// Recorded only: a number with no score.
export const turns = defineGrader('turns', { grade: (c) => c.turns.length })
