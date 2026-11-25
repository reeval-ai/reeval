// Paths written as data resolve against this file's directory, as they do in a reeval.yaml.
import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineConfig({
  agents: fakeAgent(),
  sandbox: { kind: 'docker', dockerfile: 'docker/Dockerfile' },
  profiles: {
    nightly: { defaults: { sandbox: { kind: 'docker', dockerfile: './nightly/Dockerfile' } } },
  },
})
