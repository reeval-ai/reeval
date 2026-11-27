// The trial protocol's JSON Schemas in schema/protocol/, generated from the Zod schemas in
// src/contract/trial.ts. A def that shares a hand-written type (`TurnData`, `ExecResult`, …) is
// held to the def generated from that type (the same properties and required ones), and every
// schema a hand-written type documents takes its descriptions from that type's TSDoc.
import type { z } from 'zod'
import { CONTRACT_SCHEMAS } from '../../src/contract/index.ts'
import { TRIAL_SCHEMAS, TRIAL_TYPES } from '../../src/contract/trial.ts'
import { generate, type Schema, type ShapeSchema, typeDefs } from './generate.ts'
import { PROTOCOL_SHAPES } from './shapes.ts'
import { differences, type TypeDocs, zodDefs } from './zod.ts'

/** The `$defs` `root` refers to, itself included, sorted by name. */
function reachable(defs: Record<string, Schema>, root: string): Record<string, Schema> {
  const seen = new Set<string>()
  const visit = (name: string) => {
    if (seen.has(name)) return
    const def = defs[name]
    if (!def) throw new Error(`the trial protocol refers to ${name}, which isn't in TRIAL_SCHEMAS`)
    seen.add(name)
    for (const [, ref] of JSON.stringify(def).matchAll(/"\$ref":"#\/\$defs\/([^"]+)"/g)) {
      visit(ref as string)
    }
  }
  visit(root)
  return Object.fromEntries(
    [...seen].sort((a, b) => a.localeCompare(b)).map((name) => [name, defs[name] as Schema]),
  )
}

/**
 * Where a protocol def and the def generated from its hand-written type in src/types.ts differ,
 * as lines naming the def.
 */
export function typeDrift(defs: Record<string, Schema>): string[] {
  const generated = generate(
    TRIAL_TYPES.map((type) => ({ name: type, file: 'src/types.ts', type, where: type })),
  )
  return TRIAL_TYPES.flatMap((type) => {
    const fromType = generated.get(type)?.$defs[type] ?? {}
    return differences(fromType, defs[type] ?? {}).map((line) => `${type}: ${line}`)
  })
}

/** Protocol defs with no hand-written type in `TRIAL_TYPES`, documented by the type of their name. */
const SAME_DOCS = ['Wait', 'JSONValue']

/**
 * Protocol schemas with no hand-written type of their own, and the type whose TSDoc documents the
 * fields they share with it (the exec call's are `ExecRetry`'s, spread into it).
 */
const SHARED_DOCS: Record<string, string> = {
  CaptureCallData: 'CaptureCall',
  JudgeCallData: 'ConfigJudgeData',
  ExecCall: 'ExecRetry',
}

/** Every protocol schema a hand-written type documents, with that type's def. */
function protocolTypeDocs(): TypeDocs[] {
  const own = [...TRIAL_TYPES.filter((type) => type in TRIAL_SCHEMAS), ...SAME_DOCS]
  const contract = Object.keys(CONTRACT_SCHEMAS).filter((name) => !own.includes(name))
  const typed = typeDefs({
    ...Object.fromEntries([...own, ...contract].map((name) => [name, name])),
    ...SHARED_DOCS,
  })
  const docs = (name: string, schema: z.ZodType | undefined, shared?: boolean) =>
    schema ? [{ name, schema, typed: typed[name] as Schema, shared }] : []
  const exec = (TRIAL_SCHEMAS.TrialCall as z.ZodDiscriminatedUnion).options.find(
    (option) => (option as z.ZodObject<{ op: z.ZodLiteral<string> }>).shape.op.value === 'exec',
  ) as z.ZodType | undefined
  return [
    ...own.flatMap((name) => docs(name, TRIAL_SCHEMAS[name])),
    ...contract.flatMap((name) => docs(name, CONTRACT_SCHEMAS[name])),
    ...Object.entries({ ...TRIAL_SCHEMAS, ExecCall: exec })
      .filter(([name]) => name in SHARED_DOCS)
      .flatMap(([name, schema]) => docs(name, schema, true)),
  ]
}

/** Every protocol shape's JSON Schema, by its name. */
export function protocolDocs(): Map<string, ShapeSchema> {
  const defs = zodDefs(TRIAL_SCHEMAS, {}, protocolTypeDocs())
  const drift = typeDrift(defs)
  if (drift.length) {
    throw new Error(
      `the trial protocol's Zod schemas in src/contract/trial.ts and their types in src/types.ts disagree:\n  ${drift.join('\n  ')}`,
    )
  }
  return new Map(
    PROTOCOL_SHAPES.map((shape) => [
      shape.name,
      {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $comment: `Generated from ${shape.root} in src/contract/trial.ts by \`pnpm schema:update\`; don't edit. ${shape.where}.`,
        title: shape.root,
        $ref: `#/$defs/${shape.root}`,
        $defs: reachable(defs, shape.root),
      },
    ]),
  )
}
