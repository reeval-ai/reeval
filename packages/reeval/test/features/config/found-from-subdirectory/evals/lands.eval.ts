import { defineEval, expect } from 'reeval'

// Run from deep/nested/, the config's file('marker.txt') is the project root's.
export default defineEval({
  task: async (c) => {
    expect(await c.readFile('marker.txt')).toBe('from the project root\n')
  },
})
