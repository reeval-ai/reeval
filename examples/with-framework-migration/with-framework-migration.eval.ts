import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, ran, succeeded } from 'reeval/graders'

// The agent starts from ./project, a CommonJS package with node:test tests.
const cjs = defineEnvironment('commonjs', ({ directory }) => ({ files: directory('./project') }))

export default defineEval({
  environment: cjs,
  graders: [
    hasFile('package.json', /"type":\s*"module"/),
    succeeded('no-commonjs', { required: true }),
    succeeded('npm test'),
    ran(/npm (test|t)\b|node --test/),
  ],
  task: async (c) => {
    await c.send('Migrate this package from CommonJS to ES modules. Keep npm test green.')
    // grep exits 1 when nothing matches, so this succeeds only with no CommonJS left.
    await c.exec("! grep -rnE 'require\\(|module\\.exports' src test", { label: 'no-commonjs' })
    await c.exec('npm test')
  },
})
