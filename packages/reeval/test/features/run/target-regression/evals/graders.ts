import { defineGrader } from 'reeval'

export const half = defineGrader('half', { grade: () => 1, score: () => 0.5 })
export const whole = defineGrader('whole', { grade: () => 1, score: () => 1 })
