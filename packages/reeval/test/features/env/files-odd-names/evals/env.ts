import { defineEnvironment } from 'reeval'
import { docker, fakeSandbox } from 'reeval/sandbox'

const sandbox =
  process.env.REEVAL_FIXTURE_SANDBOX === 'docker'
    ? docker()
    : fakeSandbox({ dir: new URL('../sandboxes', import.meta.url) })

// Names with a line break in them, one whose second line names another file, beside a plain one
// and one in a folder.
export const oddNames = defineEnvironment('odd-names', {
  sandbox,
  files: {
    'two\nlines.txt': 'a',
    'odd\n./plain.txt': 'b',
    'plain.txt': 'c',
    'dir/in.txt': 'd',
  },
})

export const listing = `node -e "process.stdout.write(JSON.stringify(require('fs').readdirSync('.', { recursive: true }).filter((p) => /txt$/.test(p)).sort()))"`
