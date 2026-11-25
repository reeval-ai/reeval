import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  agents: fakeAgent({
    files: { 'lib/greet.js': `export const greet = (name) => \`Hello, \${name}!\`\n` },
    text: 'Created lib/greet.js.',
  }),
  sandbox: fakeSandbox(),
})
