import { defineEnvironment, defineEval } from 'reeval'

// Claude Code and Grok Build load a plugin whole, so every part but rules is kept.
const review = defineEnvironment('review', ({ plugin }) => ({
  plugins: [
    plugin.local('../plugins/review', {
      only: ['skills', 'agents', 'commands', 'hooks', 'mcp'],
    }),
  ],
}))

export default defineEval({ environment: review, task: async () => {} })
