// A built-in grader as data: `reeval/graders`' factories with their data options, as the config's
// `graders` and another language's declared evals carry one.
import { z } from 'zod'
import type { BuiltinGraderData, BuiltinKind } from '../types.ts'
import { type Assert, jsonValueSchema, type Same } from './shared.ts'

export const builtinKindSchema = z.enum([
  'used-skill',
  'called-tool',
  'called-mcp',
  'ran',
  'searched',
  'fetched',
  'wrote',
  'in-diff',
  'not-in-diff',
  'has-file',
  'succeeded',
  'within-limits',
  'turns',
  'tokens',
  'cost',
  'duration',
  'page-status',
  'no-page-errors',
  'observed',
])

export const builtinGraderDataSchema = z.strictObject({
  builtin: builtinKindSchema,
  args: z.array(jsonValueSchema).optional(),
  name: z.string().optional(),
  weight: z.number().min(0).optional(),
  required: z.boolean().optional(),
})

export type _SameAsSchema = [
  Assert<Same<z.infer<typeof builtinKindSchema>, BuiltinKind>>,
  Assert<Same<z.infer<typeof builtinGraderDataSchema>, BuiltinGraderData>>,
  Assert<Same<keyof z.infer<typeof builtinGraderDataSchema>, keyof BuiltinGraderData>>,
]
