import { defineEnvironment } from 'reeval'
import { docker } from 'reeval/sandbox'

export const vm = defineEnvironment('vm', { sandbox: docker(), egress: 'allow-all' })

/** Keeps one CPU busy for three seconds, then prints how many CPUs the VM has. */
export const BURN = `node -e 'const t = Date.now(); while (Date.now() - t < 3000); console.log(require("os").cpus().length)'`
