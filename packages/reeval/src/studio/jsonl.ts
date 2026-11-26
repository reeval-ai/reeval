import { createReadStream } from 'node:fs'
import type { TrajectoryPage, TrajectoryRange } from '../view/api.ts'
import { parseTrajectoryLine, type TrajectoryLine } from '../view/model.ts'

/**
 * `pageTrajectory` over a file, read a chunk at a time: memory holds the longest line and the
 * page, so a file of any size pages, at the cost of reading it to the end to count its lines.
 * Lines end at `\n` only, as `parseTrajectory` splits them: `JSON.stringify` leaves U+2028 and
 * U+2029 raw inside strings, so `readline`, which ends a line at them too, would cut a line.
 */
export async function pageJsonl(file: string, range: TrajectoryRange): Promise<TrajectoryPage> {
  const end = range.start + range.limit
  const items: TrajectoryLine[] = []
  let total = 0
  const take = (text: string) => {
    const line = parseTrajectoryLine(text.endsWith('\r') ? text.slice(0, -1) : text)
    if (!line) return
    if (total >= range.start && total < end) items.push(line)
    total++
  }
  let partial: string[] = []
  const input = createReadStream(file, { encoding: 'utf8' })
  try {
    for await (const chunk of input as AsyncIterable<string>) {
      let from = 0
      for (let at = chunk.indexOf('\n'); at !== -1; at = chunk.indexOf('\n', from)) {
        partial.push(chunk.slice(from, at))
        take(partial.join(''))
        partial = []
        from = at + 1
      }
      if (from < chunk.length) partial.push(chunk.slice(from))
    }
    take(partial.join(''))
  } finally {
    input.destroy()
  }
  return { items, next: end < total ? String(end) : null, totalLines: total }
}
