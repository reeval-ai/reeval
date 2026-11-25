import { defineEval, expect } from 'reeval'

// Must fail: file() never resolves from the current directory.
export default defineEval({
  task: async (c) => {
    expect(await c.readFile('marker.txt')).toBe('from the current directory\n')
  },
})
