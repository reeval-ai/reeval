import { readFileSync } from 'node:fs'
import { defineEnvironment, defineEval } from 'reeval'
import { docker } from 'reeval/sandbox'

const answers = JSON.parse(readFileSync(new URL('../data/answers.json', import.meta.url), 'utf8'))
readFileSync(new URL('../data/a.txt', import.meta.url))

const everything = defineEnvironment('everything', ({ directory, file, git, plugin, skill }) => ({
  sandbox: docker({ dockerfile: '../docker/Dockerfile' }),
  workspace: git('../repo'),
  files: {
    'a.txt': file('../data/a.txt'),
    '.env': file('../.env'),
    ...directory('../project', { into: 'app' }),
  },
  rules: file('../RULES.md'),
  skills: [skill.local('../skills/guide')],
  plugins: [plugin.local('../plugins/tool', { only: ['skills'] })],
}))

export default defineEval({
  environment: everything,
  async task() {},
})
