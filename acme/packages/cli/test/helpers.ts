import type { AcmeServices } from '@acme/core'
import { recordingServices, type ServiceCall } from '@acme/core/testing'
import { run } from '../src/run.ts'

export interface Result {
  code: number
  stdout: string
  stderr: string
  calls: ServiceCall[]
}

/** Runs the CLI in-process against `services` (a recording stub by default). */
export async function exec(argv: string[], services?: () => AcmeServices): Promise<Result> {
  const stub = recordingServices()
  let stdout = ''
  let stderr = ''
  const code = await run(argv, {
    services: services ?? (() => stub.services),
    stdout: (text) => {
      stdout += text
    },
    stderr: (text) => {
      stderr += text
    },
  })
  return { code, stdout, stderr, calls: stub.calls }
}
