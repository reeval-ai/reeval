import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, observed, succeeded } from 'reeval/graders'
import { docker } from 'reeval/sandbox'

// Smaller than the defaults (4g, 2 CPUs, 1024 processes). swap: 0 makes 1g the hard ceiling.
const small = defineEnvironment('small', ({ directory }) => ({
  files: directory('./project'),
  sandbox: docker({ memory: '1g', swap: 0, cpus: 1, pids: 256 }),
}))

export default defineEval({
  environment: small,
  graders: [
    hasFile('src/math.js', /export function multiply/),
    succeeded('node --test'),
    observed('memory-limit', (max) => max === String(1024 ** 3)),
  ],
  task: async (c) => {
    await c.send('Add a multiply(a, b) function to src/math.js, with a test in test/math.test.js.')

    await c.exec('node --test')
    c.observe('memory-limit', (await c.exec('cat /sys/fs/cgroup/memory.max')).stdout.trim())
  },
})
