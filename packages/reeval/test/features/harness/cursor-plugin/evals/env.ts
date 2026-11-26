import { defineEnvironment } from 'reeval'
import { docker, fakeSandbox } from 'reeval/sandbox'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

export const house = defineEnvironment('house', ({ plugin }) => ({
  sandbox,
  plugins: [plugin.local('../plugin')],
}))

/** What real Cursor is asked; only the plugin's rule says what to do. */
export const prompt = 'What is the house codeword? Follow your rules for it, then stop.'

/** Prints the file the plugin's session hook copies, under where the plugin was copied. */
export const hookRan = 'cat ~/.reeval/plugins/house/hook-ran.txt'
