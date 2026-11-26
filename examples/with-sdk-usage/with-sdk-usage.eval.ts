import { defineEnvironment, defineEval, defineGrader } from 'reeval'
import { judge } from 'reeval/graders'
import { docker } from 'reeval/sandbox'

// An empty package with the Acme SDK seeded into vendor/acme.
const app = defineEnvironment('acme-app', ({ directory }) => ({
  files: { ...directory('./project'), ...directory('./acme-sdk', { into: 'vendor/acme' }) },
}))

// The hidden check calls forecast() against a stand-in for the Acme API, in a sandbox of its
// own, offline, so the agent never sees it.
const checkClient = defineGrader('check-client', ({ file }) => ({
  env: docker(),
  required: true,
  files: ['src/**', 'vendor/**', 'package.json'],
  data: { check: file('./hidden/check-client.mjs') },
  grade: async (c) => {
    await c.sandbox.writeFile('check-client.mjs', c.data.check as string)
    const { exitCode, stderr } = await c.sandbox.exec('node check-client.mjs')
    return { exitCode, stderr }
  },
  score: (grade) => (grade.exitCode === 0 ? 1 : 0),
}))

export default defineEval({
  environment: app,
  graders: [
    checkClient,
    judge('Does forecast() use client.retry rather than its own loop?', {
      inputs: { contents: ['src/forecast.js'] },
    }),
  ],
  task: async (c) => {
    await c.send(
      'Write src/forecast.js exporting forecast(city), which resolves to the temperature in ' +
        'Celsius from the Acme SDK in vendor/acme (see its README.md), with the key in ' +
        'ACME_API_KEY. The API sometimes answers 503; retry those.',
    )
  },
})
