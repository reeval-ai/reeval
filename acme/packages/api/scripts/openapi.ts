import { writeFileSync } from 'node:fs'
import { openapiJson } from '../src/openapi.ts'

writeFileSync(new URL('../../../openapi.json', import.meta.url), openapiJson())
