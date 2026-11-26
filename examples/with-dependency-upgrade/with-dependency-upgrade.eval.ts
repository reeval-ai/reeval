import { defineEnvironment, defineEval } from 'reeval'
import { hasFile, notInDiff, succeeded } from 'reeval/graders'

// The agent starts from ./project, which imports strfmt 1.4.0 through package.json's "imports".
// Both versions are vendored in vendor/, so the upgrade needs no registry.
const receipts = defineEnvironment('strfmt-1', ({ directory }) => ({
  files: directory('./project'),
}))

export default defineEval({
  environment: receipts,
  graders: [
    hasFile('package.json', /"#strfmt": "\.\/vendor\/strfmt-2\.0\.0\//, { required: true }),
    succeeded('npm test'),
    notInDiff(['test/**', 'vendor/**'], { required: true }),
  ],
  task: async (c) => {
    await c.send(
      'Upgrade strfmt from 1.4.0 to 2.0.0, which is vendored in vendor/strfmt-2.0.0 (see its ' +
        'CHANGELOG.md). Keep npm test green.',
    )
    await c.exec('npm test')
  },
})
