set -e
# The oracle's second turn: what the setup skill asks for, in each target.
if [ ! -f reeval.config.ts ]; then
  [ -f package.json ] || npm init -y >/dev/null
  if [ -f pnpm-lock.yaml ]; then pnpm add -D ~/reeval.tgz >/dev/null; else PUPPETEER_SKIP_DOWNLOAD=1 npm i -D ~/reeval.tgz --no-audit --no-fund --loglevel=error; fi
  npx reeval init --bare --agent cursor
fi
mkdir -p evals
if [ -d skills/supabase-postgres-best-practices ]; then
  cat > evals/environments.ts <<'EOF'
import { defineEnvironment } from 'reeval'
export const plain = defineEnvironment('plain', { files: { '.gitignore': 'node_modules/\n' } })
export const withSkill = plain.extendEnvironment('with-postgres-skill', ({ skill }) => ({
  skills: [skill.local('../skills/supabase-postgres-best-practices')],
}))
EOF
  cat > evals/foreign-keys.eval.ts <<'EOF'
import { defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
import { plain, withSkill } from './environments.ts'
export default defineEval({
  compare: { control: plain, variants: [withSkill] },
  graders: [hasFile('migrations/001_orders.sql', /create index[^;]*on\s+orders\s*\(\s*customer_id/i)],
  async task(c) {
  await c.send('Write migrations/001_orders.sql creating customers and orders, orders.customer_id referencing customers.')
  },
})
EOF
elif [ -d skills/firestore-rules-creation ]; then
  cat > evals/firestore-rules.eval.ts <<'EOF'
import { defineEnvironment, defineEval } from 'reeval'
import { hasFile } from 'reeval/graders'
const plain = defineEnvironment('plain', {})
const withSkill = plain.extendEnvironment('with-rules-skill', ({ skill }) => ({
  skills: [skill.local('../skills/firestore-rules-creation')],
}))
export default defineEval({
  compare: { control: plain, variants: [withSkill] },
  graders: [hasFile('firestore.rules', /request\.auth\.uid\s*==\s*uid/)],
  async task(c) {
  await c.send('Write firestore.rules so each user can read and write only their own users/{uid} document.')
  },
})
EOF
elif [ -f GEMINI.md ]; then
  cat > evals/environments.ts <<'EOF'
import { defineEnvironment } from 'reeval'
export const repo = defineEnvironment('firebase-tools', ({ directory }) => ({
  files: directory('..', { glob: ['!.env*', '!.reeval/', '!evals/', '!reeval.config.*', '!GEMINI.md'] }),
  setup: [{ run: 'npm ci --no-audit --no-fund --ignore-scripts', timeout: '10m' }],
}))
export const withRules = repo.extendEnvironment('with-gemini-md', ({ file }) => ({
  rules: file('../GEMINI.md'),
}))
EOF
  cat > evals/projects-list.eval.ts <<'EOF'
import { defineEval } from 'reeval'
import { inDiff, succeeded } from 'reeval/graders'
import { repo, withRules } from './environments.ts'
export default defineEval({
  compare: { control: repo, variants: [withRules] },
  graders: [inDiff('CHANGELOG.md'), succeeded('compiles')],
  async task(c) {
  await c.send('`firebase projects:list` should say how to create a project when the account has none.')
  await c.exec('npx tsc --noEmit -p tsconfig.json', { label: 'compiles' })
  },
})
EOF
else
  npm view tailwindcss version
  cat > evals/tailwind.eval.ts <<'EOF'
import { defineEnvironment, defineEval, defineGrader } from 'reeval'
import { hasFile } from 'reeval/graders'
const vite = defineEnvironment('vite', { files: { 'package.json': '{ "type": "module" }\n' } })
export default defineEval({
  environment: vite,
  graders: [
    hasFile('src/styles.css', /@import\s+["']tailwindcss["']/),
    defineGrader('no-v3-tailwind-directives', {
      files: ['src/styles.css'],
      grade: async (c) => !/@tailwind\s+base/.test(await c.readFile('src/styles.css')),
    }),
  ],
  async task(c) {
  await c.send('Add Tailwind CSS 4 to this project, with src/styles.css as the stylesheet.')
  },
})
EOF
fi
npx reeval run --dry-run >/dev/null
npx reeval doctor || true
