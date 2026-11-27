import type { TrialContext } from 'reeval'

/** The agent's build log, observed whole: about 36 KB, past any size an observation used to be. */
export async function observeLog(c: TrialContext): Promise<void> {
  await c.send('build it')
  c.observe('build-log', (await c.readFile('build.log')) ?? '')
}
