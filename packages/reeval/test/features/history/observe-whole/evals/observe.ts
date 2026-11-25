import type { AttemptContext } from 'reeval'

/** The agent's build log, observed whole: about 36 KB, past any size an observation used to be. */
export async function observeLog(c: AttemptContext): Promise<string> {
  await c.send('build it')
  const log = (await c.readFile('build.log')) ?? ''
  c.observe('build-log', log)
  return log
}
