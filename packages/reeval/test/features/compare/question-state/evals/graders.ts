import { defineGrader } from 'reeval'
import { execOf } from 'reeval/graders/match'

/** Whether the task's stored `cat out.txt` printed `text`. */
export const printsOut = (text: string) =>
  defineGrader(`prints-${text.trim()}`, {
    grade: (c) => execOf(c, 'cat out.txt')?.stdout ?? null,
    score: (out) => (out === text ? 1 : 0),
  })
