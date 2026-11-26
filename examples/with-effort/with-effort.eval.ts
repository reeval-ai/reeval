import { defineEnvironment, defineEval, expect, metric } from 'reeval'

const math = defineEnvironment('math', ({ directory }) => ({ files: directory('./project') }))
const withLayout = math.extendEnvironment('project-layout', ({ skill }) => ({
  skills: [skill.local('./skills/project-layout')],
}))

export default defineEval({
  compare: { control: math, variants: [withLayout] },
  runs: 4,
  target: metric(0.75),
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js, with a test.')

    expect(await c.readFile('test/math.test.js')).toContain('multiply')
    await expect(c.exec('node --test')).toSucceed()
  },
})
