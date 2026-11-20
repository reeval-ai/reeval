import { colors } from './colors.ts'
import type { OutputStream, ReevalEvent, Renderer } from './events.ts'
import { attemptAxes, debugLines, progressLine } from './format.ts'
import { noticeLines, PrepareLines, planLines, startLine } from './header.ts'
import type { OutputOptions } from './mode.ts'
import { resultLines } from './results.ts'
import { pointerLine } from './status.ts'
import { Tagger } from './tags.ts'

const MAX_LINES = 12
/** Agents read whole lines, so the header's notes don't wrap. */
const WIDTH = Number.POSITIVE_INFINITY

export type AgentRendererOptions = {
  out: OutputStream
  output: OutputOptions
  verbosity?: 0 | 1 | 2
}

export class AgentRenderer implements Renderer {
  #prepare = new PrepareLines()
  readonly #o: AgentRendererOptions
  readonly #c = colors(false)
  /** `[key]` prefixes for `-v` lines, from each attempt's start. */
  readonly #labels = new Map<string, string>()
  readonly #tags = new Tagger()

  constructor(options: AgentRendererOptions) {
    this.#o = options
  }

  #write(text: string) {
    this.#o.out.write(`${text.trimEnd()}\n`)
  }

  onEvent(e: ReevalEvent): void {
    switch (e.type) {
      case 'plan':
        for (const line of planLines(this.#c, e, WIDTH)) this.#write(line)
        return
      case 'run-start':
        // No attempt's logs print here, whatever --output-logs says.
        this.#write(startLine(this.#c, { ...this.#o.output, outputLogs: 'none' }))
        return
      case 'collected':
        this.#tags.addFile(e.evals)
        return
      case 'eval-start': {
        const tag = this.#tags.label(e.id, e.attempt?.n ?? 1)
        this.#labels.set(e.key, `[${tag} ${attemptAxes(e.attempt, 'agent')}]`)
        return
      }
      case 'debug': {
        const label = this.#labels.get(e.key) ?? `[${e.key}]`
        for (const line of debugLines(this.#c, e.line, this.#o.verbosity === 2)) {
          this.#write(`${label} ${line}`)
        }
        return
      }
      case 'eval-progress': {
        if (e.progress.kind !== 'browser-download' && e.progress.kind !== 'warning') return
        const label = this.#labels.get(e.key) ?? `[${e.key}]`
        this.#write(`${label} ${progressLine(this.#c, e.progress)}`)
        return
      }
      case 'prepare':
        for (const line of this.#prepare.lines(this.#c, e, WIDTH, MAX_LINES)) this.#write(line)
        return
      case 'notice':
        for (const line of noticeLines(this.#c, e, WIDTH)) this.#write(line)
        return
      case 'run-end': {
        this.#write('')
        const lines = resultLines(e.record, this.#c, {
          remarks: e.remarks ?? null,
          // An agent acts on the detail a terminal keeps behind -v.
          verbose: true,
          width: WIDTH,
          pointer: pointerLine(e.summaryPath),
        })
        for (const line of lines) this.#write(line)
        return
      }
      default:
        return
    }
  }

  close(): void {}
}
