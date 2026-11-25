import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'

export default defineConfig({ agents: fakeAgent({ script: [[{ exec: 'cat ready.txt' }]] }) })
