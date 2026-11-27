import { type TrialContext, defineGrader } from 'reeval'
import { execOf } from 'reeval/graders/match'

/** A labeled command before the turn (the build is not there yet), then one after it with output past the 128 KiB cap. */
export async function runExecs(c: TrialContext): Promise<void> {
  await c.exec('test -f out.txt', { label: 'before' })
  await c.send('build it')
  await c.exec('cat out.txt; head -c 200000 /dev/zero | tr "\\0" a; echo; echo warn >&2', {
    label: 'after',
  })
}

/** Whether the `after` command's `stream` starts with the build. */
export const readsBuild = (stream: 'stdout' | 'stderr') =>
  defineGrader(`reads-the-build-${stream}`, {
    grade: (c) => execOf(c, 'after')?.[stream]?.split('\n')[0] ?? null,
    score: (line) => (line === 'built' ? 1 : 0),
  })
