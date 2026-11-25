import { defineConfig } from 'reeval'
import { fakeAgent } from 'reeval/agent'
import { fakeSandbox } from 'reeval/sandbox'

export default defineConfig({
  agents: fakeAgent({
    files: { 'greet.js': `export const greet = (name) => \`Hello, \${name}!\`\n` },
    text: 'Created greet.js.',
    withSkill: {
      files: { 'greet.js': `export const greet = (name) => \`Ahoy, \${name}!\`\n` },
      text: 'Created greet.js in the house style.',
    },
  }),
  sandbox: fakeSandbox(),
})
