// Compile-time checks of `defineConfig`, run by `pnpm typecheck` (tsconfig.json here): a key the
// config doesn't have is a type error, at the top level, in a profile and from the callback form,
// so a renamed or misspelled option fails `tsc` as well as `reeval run`. An unused
// `@ts-expect-error` fails the build too.

import { fakeAgent } from '../../src/agent.ts'
import { defineConfig, defineEnvironment } from '../../src/index.ts'

const app = defineEnvironment('app', {})

const config = defineConfig({
  agents: fakeAgent(),
  environments: app,
  profiles: { smoke: { limit: { agents: ['fake'] }, defaults: { runs: 1, agents: fakeAgent() } } },
})
const profiles: object | undefined = config.profiles
void profiles
defineConfig(({ secret }) => ({ env: { KEY: secret.fromEnv('KEY') }, environments: [app] }))

// Each sits beside a key the config has, as in a real config: a lone unknown key is refused
// anyway, since every key is optional.
// @ts-expect-error harnesses is agents
defineConfig({ harnesses: fakeAgent(), runs: 1 })
// @ts-expect-error agent is agents
defineConfig({ agent: fakeAgent(), runs: 1 })
// @ts-expect-error environment is environments
defineConfig({ environment: app, runs: 1 })
// @ts-expect-error a misspelled key
defineConfig({ agnets: fakeAgent(), runs: 1 })
defineConfig({
  // @ts-expect-error limit.harnesses is limit.agents
  profiles: { smoke: { limit: { harnesses: ['fake'], runs: 1 } } },
})
defineConfig({
  // @ts-expect-error defaults.harnesses is defaults.agents
  profiles: { smoke: { defaults: { harnesses: fakeAgent(), runs: 1 } } },
})
// @ts-expect-error the callback's config is checked too
defineConfig(() => ({ harnesses: fakeAgent(), runs: 1 }))
