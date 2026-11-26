import { defineEval, defineGrader } from 'reeval'
import { fetched } from 'reeval/graders'
import { beacon, plain, prompt, publishedAt, randomness, url } from './env.ts'

/**
 * The reply has a round drand published during the turn and that round's randomness, fetched
 * with the web tool, not the shell, and the turn left nothing unreported.
 */
const reported = defineGrader('reports-the-beacon', {
  grade: async (c) => {
    const turn = c.turns[0]
    const reply = beacon.exec(turn?.text ?? '')
    const round = Number(reply?.[1])
    return {
      completed: turn?.status === 'completed',
      recent:
        !!reply && Math.abs(publishedAt(round) - Date.parse(turn?.startedAt ?? '')) < 10 * 60_000,
      randomness: !!reply && reply[2] === (await randomness(round)),
      shell: (turn?.trajectory ?? []).some(
        (e) => e.type === 'tool' && JSON.stringify(e.input).includes('drand'),
      ),
      unreported: turn?.unreported.length ?? 0,
    }
  },
  score: (g) => (g.completed && g.recent && g.randomness && !g.shell && g.unreported === 0 ? 1 : 0),
})

// The agent really fetched the page, and the trajectory shows the fetch. The Cursor SDK drops
// web calls from its stream; the adapter's runner recovers them from the stored conversation.
export default defineEval({
  environment: plain,
  graders: [reported, fetched(url)],
  task: async (c) => {
    await c.send(prompt)
  },
})
