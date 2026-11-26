import { defineEnvironment, defineEval, expect } from 'reeval'

// checks/call.mjs goes in the sandbox's home, outside the workspace and its diff.
const math = defineEnvironment('math', ({ directory, file }) => ({
  files: { ...directory('./project'), '~/checks/call.mjs': file('./checks/call.mjs') },
}))

const cases = [
  { key: 'subtract', a: 7, b: 3, want: '4' },
  { key: 'multiply', a: 2, b: 3, want: '6' },
  { key: 'power', a: 2, b: 5, want: '32' },
]

export default defineEval({
  cases,
  environment: math,
  task: async (c, item) => {
    await c.send(`Add a ${item.key}(a, b) function to src/math.js.`)

    const run = await c.exec(`node ~/checks/call.mjs ${item.key} ${item.a} ${item.b}`)
    expect(run).toSucceed()
    expect(run.stdout.trim()).toBe(item.want)
  },
})
