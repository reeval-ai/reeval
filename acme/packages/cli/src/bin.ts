#!/usr/bin/env node
import { Acme } from '@acme/sdk'
import { run } from './run.ts'

// A reader that stops early, such as `head`, closes the pipe: that is not a failure of the CLI.
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code !== 'EPIPE') throw error
  })
}

let acme: Acme | undefined

process.exitCode = await run(process.argv.slice(2), {
  services: () => {
    acme ??= new Acme()
    return acme
  },
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
})
