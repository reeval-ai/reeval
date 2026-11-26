import type { AttemptContext, ExecResult } from 'reeval'

/** A labeled command before the turn (the build is not there yet), then one after it with output past the 128 KiB cap. */
export async function runExecs(c: AttemptContext): Promise<ExecResult> {
  await c.exec('test -f out.txt', { label: 'before' })
  await c.send('build it')
  return c.exec('cat out.txt; head -c 200000 /dev/zero | tr "\\0" a; echo; echo warn >&2', {
    label: 'after',
  })
}
