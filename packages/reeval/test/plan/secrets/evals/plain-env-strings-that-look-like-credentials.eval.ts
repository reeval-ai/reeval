import { defineEnvironment, defineEval } from 'reeval'

const plain = defineEnvironment('plain-env', ({ mcp }) => ({
  env: {
    UPSTREAM: 'ghp_0123456789abcdefghijABCDEFGHIJ0123456789',
    DATABASE_URL: 'postgres://app:hunter2@db:5432/app',
    NODE_ENV: 'test',
  },
  mcp: {
    db: mcp.stdio('npx', ['-y', 'db-server'], {
      env: {
        DB_PASSWORD: 'hunter2-hunter2',
        MAX_TOKENS: '4096',
        DB_HOST: 'localhost',
        GOOGLE_APPLICATION_CREDENTIALS: '/secrets/sa.json',
        TOKEN_ENDPOINT: 'https://oauth2.googleapis.com/token',
      },
    }),
  },
}))

export default defineEval({ environment: plain, task: async () => {} })
