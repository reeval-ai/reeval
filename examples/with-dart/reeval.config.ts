import { readFileSync } from 'node:fs'
import { defineConfig } from 'reeval'
import { fakeHarness } from 'reeval/harness'
import { boat } from 'reeval/provider/boat'
import { daytona } from 'reeval/provider/daytona'
import { profiles } from '../profiles.ts'

const fakeAgent = (path: string) =>
  readFileSync(new URL(`./fake-agent/${path}`, import.meta.url), 'utf8')

export default defineConfig({
  include: ['*.eval.ts'],
  // A scripted agent that copies ./fake-agent's files into the workspace. The environment's
  // sandbox still applies, so even the fake agent runs in the Dart image.
  harnesses: fakeHarness({
    files: {
      'fizzbuzz.dart': fakeAgent('fizzbuzz.dart'),
      'fizzbuzz_test.dart': fakeAgent('fizzbuzz_test.dart'),
    },
    text: 'I wrote fizzbuzz.dart and its checks in fizzbuzz_test.dart.',
  }),
  // The real agents: `--profile claude-code`, or any other in ../profiles.ts. `--profile boat` and
  // `--profile daytona` run the sandbox on the provider's machines; a Daytona sandbox keeps its own
  // network, so that profile allows all egress.
  profiles: {
    ...profiles,
    boat: { provider: boat() },
    daytona: { provider: daytona(), defaults: { egress: 'allow-all' } },
  },
})
