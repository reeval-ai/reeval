import { defineEnvironment, defineEval } from 'reeval'

const fetched = defineEnvironment('fetched', ({ plugin }) => ({
  plugins: [
    plugin.git('github:acme/agent-plugins', { ref: 'v1.2.0', path: 'plugins/review' }),
    plugin.npm('@acme/review-plugin@1.2.0', { only: ['skills'] }),
  ],
}))
const pinned = fetched.extend('pinned', ({ plugin }) => ({
  plugins: [
    plugin.git('github:acme/agent-plugins', {
      ref: 'v1.3.0',
      path: 'plugins/review',
      build: { run: ['pnpm install --frozen-lockfile', 'pnpm build'], cwd: '.' },
    }),
  ],
}))

export default defineEval({ environment: fetched, task: async () => {} })
