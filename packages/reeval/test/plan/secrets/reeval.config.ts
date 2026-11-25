import { defineConfig, defineEnvironment } from 'reeval'
import { fakeAgent } from 'reeval/agent'

const session = defineEnvironment('session', ({ mcp }) => ({
  mcp: { app: mcp.http('https://app.example.com/mcp', { headers: { Cookie: 'sid=s3ss10n' } }) },
}))

export default defineConfig({
  agents: fakeAgent(),
  profiles: { headers: { defaults: { environments: session } } },
})
