import { defineGrader } from 'reeval'
import { hasFile } from 'reeval/graders/match'

const FILES = ['from-baseline.txt', 'from-variant.txt', 'from-ignored.txt']

/** Which of the environments' files the cell's workspace has. */
export const ownFile = defineGrader('own-file', {
  files: FILES,
  grade: async (c) => {
    const present: string[] = []
    for (const path of FILES) if (await hasFile(c, path)) present.push(path)
    return present
  },
  score: (present) => (present.length === 1 ? 1 : 0),
})
