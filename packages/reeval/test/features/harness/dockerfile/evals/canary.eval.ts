import { defineEval, defineGrader } from 'reeval'
import { execOf } from 'reeval/graders/match'
import { plain } from './env.ts'

const sdk = defineGrader('cursor-sdk', {
  grade: (c) => execOf(c, 'find')?.stdout.trim() ?? null,
  score: (found) => (/\/@cursor\/sdk$/.test(found ?? '') ? 1 : 0),
})

// Must fail: it isn't built on Cursor's image, so the Cursor SDK isn't there.
export default defineEval({
  environment: plain,
  graders: [sdk],
  task: async (c) => {
    await c.exec(
      'ls -d "$HOME"/.ai-sdk-harness/.harness-bootstrap/cursor-sdk/node_modules/@cursor/sdk 2>/dev/null',
      { label: 'find' },
    )
  },
})
