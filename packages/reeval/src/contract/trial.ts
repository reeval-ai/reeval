// The trial protocol's contract: the calls an eval's body makes on its trial (`c.send`,
// `c.exec`, `c.readFile`, `c.writeFile`, `c.observe`, `c.decide`, …), as a runner in another language would
// send them to reeval, and reeval's replies. Today an eval's body runs in reeval's own worker, so
// no call crosses a process boundary yet; the schemas are the spec such a runner codes against,
// with their JSON Schema in schema/protocol/. Results reuse the trial's own types (`TurnData`,
// `ExecResult`, `Capture`), held to them at compile time and described by their TSDoc;
// a `.describe()` here is the protocol's own wording, for what no hand-written type documents.
import { z } from 'zod'
import { MAX_TIMER_MS, TIMER_LIMIT } from '../duration.ts'
import type {
  Capture,
  CaptureConsoleMessage,
  CaptureFailedRequest,
  CaptureInstruction,
  CapturePage,
  CaptureWait,
  Cell,
  CellRole,
  Diff,
  ExecEnv,
  ExecResult,
  ExecRetry,
  FileChange,
  TokenUsage,
  TrajectoryEvent,
  TurnData,
  TurnStatus,
  Wait,
  WebEventType,
} from '../types.ts'
import { captureWindowSchema } from './config.ts'
import { traitsSchema } from './environment.ts'
import { judgeModelNameSchema, sharedInputFields } from './judge.ts'
import { VAR } from './plain.ts'
import {
  type Assert,
  dataProblem,
  durationSchema,
  jsonValueSchema,
  type Same,
  tokenUsageSchema,
} from './shared.ts'

const nullableNumber = z.number().nullable()

export const fileChangeSchema = z.strictObject({
  path: z.string(),
  status: z.enum(['added', 'modified', 'deleted']),
})

export const diffSchema = z.strictObject({
  patch: z.string(),
  files: z.array(fileChangeSchema),
})

export const turnStatusSchema = z.enum(['completed', 'aborted', 'error'])

export const webEventTypeSchema = z.enum(['web-search', 'web-fetch'])

const at = { ts: z.string(), atMs: z.number(), step: z.number().optional() }
const toolPayload = {
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  outputView: z.enum(['model', 'full']).optional(),
  outputTruncated: z.strictObject({ bytes: z.number() }).optional(),
}

export const trajectoryEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...at,
    type: z.enum(['text', 'reasoning']),
    text: z.string(),
    durationMs: nullableNumber,
    subagent: z.string().optional(),
  }),
  z.strictObject({
    ...at,
    type: z.literal('file-edit'),
    toolCallId: z.string(),
    path: z.string(),
    kind: z.enum(['create', 'modify', 'write', 'delete']),
    added: nullableNumber,
    removed: nullableNumber,
    ...toolPayload,
    durationMs: nullableNumber,
    stalled: z.boolean().optional(),
    subagent: z.string().optional(),
    durationInferred: z.literal(true).optional(),
  }),
  z.strictObject({
    ...at,
    type: z.literal('web-search'),
    toolCallId: z.string(),
    query: z.string(),
    references: nullableNumber,
    ...toolPayload,
    ok: z.boolean().nullable().optional(),
    durationMs: nullableNumber,
    stalled: z.boolean().optional(),
    subagent: z.string().optional(),
    durationInferred: z.literal(true).optional(),
  }),
  z.strictObject({
    ...at,
    type: z.literal('web-fetch'),
    toolCallId: z.string(),
    url: z.string(),
    ok: z.boolean().nullable(),
    status: z.number().optional(),
    bytes: z.number().optional(),
    ...toolPayload,
    durationMs: nullableNumber,
    stalled: z.boolean().optional(),
    subagent: z.string().optional(),
    durationInferred: z.literal(true).optional(),
  }),
  z.strictObject({
    ...at,
    type: z.literal('tool'),
    toolCallId: z.string(),
    tool: z.string(),
    input: z.unknown(),
    output: z.unknown(),
    outputView: z.enum(['model', 'full']).optional(),
    outputTruncated: z.strictObject({ bytes: z.number() }).optional(),
    ok: z.boolean().nullable(),
    durationMs: nullableNumber,
    stalled: z.boolean().optional(),
    subagent: z.string().optional(),
    durationInferred: z.literal(true).optional(),
  }),
  z.strictObject({ ...at, type: z.literal('error'), message: z.string() }),
  z.strictObject({ ...at, type: z.literal('retry'), message: z.string() }),
  z.strictObject({
    ...at,
    type: z.literal('model-call'),
    request: z.string(),
    status: nullableNumber,
    durationMs: z.number(),
    firstByteMs: nullableNumber,
    usage: tokenUsageSchema.nullable(),
    model: z.string().nullable(),
    stream: z.literal(true).optional(),
    role: z.enum(['main', 'side']).optional(),
  }),
])

export const turnDataSchema = z.strictObject({
  prompt: z.string(),
  text: z.string(),
  status: turnStatusSchema,
  startedAt: z.string(),
  durationMs: z.number(),
  trajectory: z.array(trajectoryEventSchema),
  usage: tokenUsageSchema.nullable(),
  model: z.string().nullable(),
  unreported: z.array(webEventTypeSchema),
  diff: diffSchema,
})

export const execResultSchema = z.strictObject({
  exitCode: z.number().int(),
  stdout: z.string(),
  stderr: z.string(),
})

export const execRetrySchema = z.strictObject({
  retries: z
    .number()
    .int('must be a whole number, from 0')
    .min(0, 'must be a whole number, from 0')
    .optional(),
  interval: z
    .number()
    .min(0, 'must be 0 or more milliseconds')
    .max(MAX_TIMER_MS, `must be ${TIMER_LIMIT}`)
    .optional(),
})

export const execEnvSchema = z.record(
  z
    .string()
    .regex(VAR, 'must be a variable name: letters, digits and _, not starting with a digit'),
  z.string().refine((v) => !v.includes('\0'), 'must not hold a NUL character'),
)

/** A background command has no exit for `retries` to wait on, and no result for `label` to name. */
const noBackgroundRetry = (
  options: { background?: boolean; retries?: number; interval?: number; label?: string },
  ctx: z.RefinementCtx,
) => {
  if (!options.background) return
  for (const key of ['retries', 'interval', 'label'] as const) {
    if (options[key] === undefined) continue
    ctx.addIssue({
      code: 'custom',
      path: [key],
      message:
        key === 'label'
          ? "can't be used with background: true, whose result reeval doesn't keep: drop one of them"
          : "can't be used with background: true, whose exit reeval doesn't wait for: drop one of them",
    })
  }
}

const execLabelSchema = z.string().min(1, 'must not be empty')

export const execOptionsSchema = z
  .strictObject({
    background: z.boolean().optional(),
    env: execEnvSchema.optional(),
    label: execLabelSchema.optional(),
    ...execRetrySchema.shape,
  })
  .superRefine(noBackgroundRetry)

/** What's wrong with `c.exec()`'s options, or undefined. */
export const execOptionsProblem = (value: unknown): string | undefined =>
  dataProblem(execOptionsSchema, value, 'c.exec()', () => Object.keys(execOptionsSchema.shape))

const turnIndex = z
  .number()
  .int('must be a turn index, from 0')
  .min(0, 'must be a turn index, from 0')
  .describe("The turn's index, from 0.")

const captureConsoleMessageSchema = z.strictObject({
  level: z.enum(['error', 'warning', 'info', 'log', 'debug']),
  text: z.string(),
  source: z.string(),
  url: z.string().optional(),
})

const captureFailedRequestSchema = z.strictObject({
  method: z.string(),
  url: z.string(),
  status: z.number().optional(),
  error: z.string().optional(),
})

const capturePageFields = {
  status: z.number().optional(),
  finalUrl: z.string(),
  console: z.array(captureConsoleMessageSchema),
  errors: z.array(z.string()),
  failedRequests: z.array(captureFailedRequestSchema),
  dropped: z.number().optional(),
}

const capturePageSchema = z.strictObject(capturePageFields)

export const captureSchema = z.strictObject({
  name: z.string(),
  port: z.number(),
  path: z.string(),
  viewport: z.union([captureWindowSchema, z.literal('full-page')]),
  file: z.strictObject({ path: z.string(), sha256: z.string(), bytes: z.number() }),
  ...capturePageFields,
})

export type _SameAsSchema = [
  Assert<Same<z.infer<typeof captureWaitSchema>, CaptureWait>>,
  Assert<Same<z.infer<typeof waitSchema>, Wait>>,
  Assert<Same<z.infer<typeof captureInstructionSchema>, CaptureInstruction>>,
  Assert<Same<z.infer<typeof cellSchema>, Cell>>,
  Assert<Same<z.infer<typeof cellRoleSchema>, CellRole>>,
  Assert<Same<z.infer<typeof captureSchema>, Capture>>,
  Assert<Same<z.infer<typeof capturePageSchema>, CapturePage>>,
  Assert<Same<z.infer<typeof captureConsoleMessageSchema>, CaptureConsoleMessage>>,
  Assert<Same<z.infer<typeof captureFailedRequestSchema>, CaptureFailedRequest>>,
  Assert<Same<z.infer<typeof tokenUsageSchema>, TokenUsage>>,
  Assert<Same<z.infer<typeof fileChangeSchema>, FileChange>>,
  Assert<Same<z.infer<typeof diffSchema>, Diff>>,
  Assert<Same<z.infer<typeof turnStatusSchema>, TurnStatus>>,
  Assert<Same<z.infer<typeof webEventTypeSchema>, WebEventType>>,
  Assert<Same<z.infer<typeof trajectoryEventSchema>, TrajectoryEvent>>,
  Assert<Same<z.infer<typeof turnDataSchema>, TurnData>>,
  Assert<Same<z.infer<typeof execResultSchema>, ExecResult>>,
  Assert<Same<z.infer<typeof execRetrySchema>, ExecRetry>>,
  Assert<Same<z.infer<typeof execEnvSchema>, ExecEnv>>,
]

const nonEmpty = z.string().regex(/\S/, 'must not be empty')

/**
 * A capture's name is the `<name>.png` segment of its artifact path, so it stays within what
 * the studio serves as a path segment (`parseStudioPath` in `src/view/api.ts`): a leading letter or digit, and
 * short enough to leave room for `.png`.
 */
export const CAPTURE_NAME_MAX = 100
export const CAPTURE_NAME = new RegExp(`^[a-z0-9][a-z0-9_-]{0,${CAPTURE_NAME_MAX - 1}}$`)
export const CAPTURE_NAME_RULE = `must be 1 to ${CAPTURE_NAME_MAX} of a-z, 0-9, _ and -, starting with a letter or digit`

const portSchema = z
  .number()
  .int()
  .min(1, 'a port from 1 to 65535')
  .max(65535, 'a port from 1 to 65535')
const millisSchema = z
  .number()
  .positive('more than zero milliseconds')
  .max(MAX_TIMER_MS, TIMER_LIMIT)

export const captureWaitSchema = z.enum(['load', 'idle'])

export const waitSchema = z.union([captureWaitSchema, z.strictObject({ ms: millisSchema })])

export const captureInstructionSchema = z.union([nonEmpty, z.strictObject({ wait: waitSchema })])

export const captureCallDataSchema = z
  .strictObject({
    name: z.string().regex(CAPTURE_NAME, CAPTURE_NAME_RULE).optional(),
    path: z.string().optional(),
    viewport: z.union([captureWindowSchema, z.literal('full-page')]).optional(),
    timeout: durationSchema.optional(),
    wait: waitSchema.optional(),
    instructions: z
      .array(captureInstructionSchema)
      .optional()
      .describe('Journey: goal strings and `{ wait }` beats, run by the vision model.'),
    model: z.string().optional(),
  })
  .describe(
    "`c.capture()`'s camera and path as data. Default `path` is `/`; default `name` is derived from the path. A test's `fakeInstructions` journey is TypeScript-only.",
  )

const handleId = nonEmpty.describe('A background process, as an exec or serve reply named it.')

const jsonObjectSchema = z.record(z.string(), jsonValueSchema)

export const decideStatePartSchema = z
  .discriminatedUnion('type', [
    z.strictObject({ type: z.literal('text'), text: z.string() }),
    z.strictObject({ type: z.literal('json'), value: jsonValueSchema }),
    z
      .strictObject({ type: z.literal('capture'), name: nonEmpty })
      .describe("A capture's PNG as an image file part, as `c.part(capture)` gives it."),
    z
      .strictObject({
        type: z.literal('inputs'),
        output: sharedInputFields.output,
        diff: sharedInputFields.diff,
        contents: z.array(nonEmpty).optional(),
        observations: sharedInputFields.observations,
        trajectory: sharedInputFields.trajectory,
        on: z
          .strictObject({ turn: turnIndex })
          .optional()
          .describe('The turn `output`, `diff` and `trajectory` read instead of the latest.'),
      })
      .describe(
        "The judge's inputs as one JSON part, masked as a judge's are, as `c.state(inputs)` gives them.",
      ),
  ])
  .describe('One part of the state a decision model is shown.')

export const decideCallDataSchema = z
  .strictObject({
    model: judgeModelNameSchema
      .optional()
      .describe("`'provider/model'`. Default `decide.model`, then `analysis.model`."),
    state: z
      .union([z.string(), jsonObjectSchema, z.array(decideStatePartSchema).min(1)])
      .describe('What the model decides about: a string, a JSON object or parts.'),
    questions: z
      .record(nonEmpty, jsonValueSchema)
      .describe("The questions by id, as the AI SDK's `experimental_decide` takes them."),
    providerOptions: z.record(z.string(), jsonObjectSchema).optional(),
  })
  .describe("`c.decide()`'s call as data: the model by name, the state and the questions.")

export const decideResultSchema = z
  .strictObject({
    answers: z
      .record(z.string(), jsonValueSchema)
      .describe("Each question's answer, by id, as `experimental_decide` returns it."),
    usage: z.strictObject({
      inputTokens: z.number().optional(),
      outputTokens: z.number().optional(),
      totalTokens: z.number().optional(),
    }),
    warnings: z.array(jsonValueSchema),
    providerMetadata: z.record(z.string(), jsonObjectSchema).optional(),
    response: z.strictObject({
      modelId: z.string(),
      timestamp: z.string().describe('ISO 8601.'),
    }),
  })
  .describe("`c.decide()`'s result, its response's id, headers and body left out.")

/** An observation's name: one a query, a tally line and a judge's input can carry as it is. */
export const OBSERVE_NAME = /^[A-Za-z0-9_.:/-]{1,64}$/

export const trialCallSchema = z
  .discriminatedUnion('op', [
    z
      .strictObject({ op: z.literal('send'), prompt: z.string().describe("The turn's prompt.") })
      .describe('`c.send(prompt)`: the next turn of the agent session. Replies with a turn.'),
    z
      .strictObject({
        op: z.literal('exec'),
        command: nonEmpty.describe('A shell command, run in the workspace.'),
        background: z
          .boolean()
          .optional()
          .describe('Leave it running and reply with its handle, not its output.'),
        env: execEnvSchema.optional(),
        label: execLabelSchema
          .optional()
          .describe('A name kept with its result, for a grader to find it by.'),
        ...execRetrySchema.shape,
      })
      .superRefine(noBackgroundRetry)
      .describe(
        '`c.exec(command, { background?, env?, label?, retries?, interval? })`: a command in the sandbox. Replies with its exit code and output (the last try, with `retries`), or with a handle when it runs in the background.',
      ),
    z
      .strictObject({
        op: z.literal('serve'),
        command: nonEmpty.describe('A shell command; `PORT` is set to the port.'),
        port: portSchema
          .optional()
          .describe('The container port. Omit it and reeval allocates one.'),
      })
      .describe('`c.serve(command, port?)`: a background process, once it listens, and its port.'),
    z
      .strictObject({ op: z.literal('kill'), handle: handleId })
      .describe("`handle.kill()`: stops a background process. Killing one that's gone is fine."),
    z
      .strictObject({
        op: z.literal('capture'),
        target: z
          .union([z.strictObject({ port: portSchema }), z.strictObject({ handle: handleId })])
          .describe('A container port, or a serve handle by its id.'),
        options: captureCallDataSchema.optional(),
      })
      .describe(
        '`c.capture(target, options)`: screenshots a path on a tunneled sandbox port and writes `artifacts/<name>.png`. Replies with the capture.',
      ),
    z
      .strictObject({
        op: z.literal('readFile'),
        path: nonEmpty.describe('Workspace-relative, or `~/` for the home directory.'),
      })
      .describe(
        '`c.readFile(path)`. Replies with its contents, or null when there is no such file.',
      ),
    z
      .strictObject({
        op: z.literal('writeFile'),
        path: nonEmpty.describe('Workspace-relative, or `~/` for the home directory.'),
        contents: z.string().describe("The file's contents, in `encoding`."),
        encoding: z
          .enum(['utf8', 'base64'])
          .optional()
          .describe('How `contents` is encoded; base64 carries bytes. Default `utf8`.'),
      })
      .describe('`c.writeFile(path, contents)`, creating its directories.'),
    z
      .strictObject({
        op: z.literal('observe'),
        name: z
          .string()
          .regex(OBSERVE_NAME, 'must be 1 to 64 letters, digits, _ . : / or -')
          .describe('What the value is of, e.g. `installed`.'),
        value: jsonValueSchema.describe('Any JSON, nested at most 64 levels deep.'),
      })
      .describe(
        "`c.observe(name, value)`: records a fact about the trial that never affects its outcome. A name observed again keeps the last value. Fails after the body's `done`.",
      ),
    z
      .strictObject({ op: z.literal('decide'), ...decideCallDataSchema.shape })
      .describe(
        '`c.decide(call)`. Replies with its result. A provider failure fails the call and the trial, as an infrastructure error.',
      ),
  ])
  .describe(
    "One call an eval's body makes on its trial. The sandbox and the agent session start on the first call that needs them; there's no call to start them.",
  )

export const trialErrorSchema = z
  .looseObject({
    name: z.string().describe("The error's class, e.g. `UsageError` or `AssertionError`."),
    message: z.string(),
  })
  .describe("Why a call failed, in reeval's words.")

export const trialThrownSchema = trialErrorSchema
  .extend({
    stack: z.string().optional().describe("The error's traceback, in the runner's own format."),
    meta: z
      .record(z.string(), jsonValueSchema)
      .optional()
      .describe("An `EvalError`'s meta: a JSON object recorded beside its reason."),
  })
  .describe(
    "What an eval's body threw: an `EvalError` (`name` `EvalError`, its reason as `message`, and its meta) or any other error.",
  )

const id = nonEmpty.describe('Pairs a reply with its request.')

export const trialRequestSchema = z
  .strictObject({ id, call: trialCallSchema })
  .describe('A call, numbered so its reply can find it.')

export const trialReplySchema = z
  .union([
    z.discriminatedUnion('op', [
      z.strictObject({ id, ok: z.literal(true), op: z.literal('send'), turn: turnDataSchema }),
      z.strictObject({
        id,
        ok: z.literal(true),
        op: z.literal('exec'),
        result: z.union([
          execResultSchema,
          z.strictObject({ handle: handleId }).describe('A background process, still running.'),
        ]),
      }),
      z.strictObject({
        id,
        ok: z.literal(true),
        op: z.literal('serve'),
        handle: handleId,
        port: z.number().describe('The container port it listens on.'),
      }),
      z.strictObject({ id, ok: z.literal(true), op: z.literal('kill') }),
      z.strictObject({ id, ok: z.literal(true), op: z.literal('capture'), capture: captureSchema }),
      z.strictObject({
        id,
        ok: z.literal(true),
        op: z.literal('readFile'),
        contents: z.string().nullable().describe('Null when there is no such file.'),
      }),
      z.strictObject({ id, ok: z.literal(true), op: z.literal('writeFile') }),
      z.strictObject({ id, ok: z.literal(true), op: z.literal('observe') }),
      z.strictObject({
        id,
        ok: z.literal(true),
        op: z.literal('decide'),
        result: decideResultSchema,
      }),
    ]),
    z.strictObject({
      id,
      ok: z.literal(false),
      op: z.enum([
        'send',
        'exec',
        'readFile',
        'writeFile',
        'observe',
        'serve',
        'kill',
        'capture',
        'decide',
      ]),
      error: trialErrorSchema,
    }),
  ])
  .describe("reeval's reply to a call: its result, or the error it threw.")

export const cellRoleSchema = z.enum(['baseline', 'variant'])

export const cellSchema = z.strictObject({
  key: z.string(),
  harness: z.string(),
  environment: z.string(),
  sandbox: z.string(),
  role: cellRoleSchema,
  variant: z.string().optional(),
  traits: traitsSchema.optional(),
})

export const trialStartSchema = z
  .strictObject({
    type: z.literal('start'),
    trial: z
      .strictObject({
        id: nonEmpty,
        cell: cellSchema,
        n: z.number().int().min(1, 'a run number, from 1').describe('The run number, from 1.'),
      })
      .describe('`c.trial`: which cell of the matrix this trial is, and its run number.'),
    file: nonEmpty.describe('The eval file, relative to the project.'),
    body: nonEmpty.describe("The eval's `body`, as its declaration named it."),
  })
  .describe(
    "reeval to the runner: run this eval's body for this trial. Nothing has started yet: the sandbox and the agent session start on the body's first call that needs them, so its own code runs first. The runner sends its calls, then `done`.",
  )

export const trialAbortSchema = z
  .strictObject({
    type: z.literal('abort'),
    reason: z
      .enum(['timeout', 'canceled'])
      .describe("`timeout`: the eval's `timeout` ran out. `canceled`: the run was stopped."),
    message: z.string().describe("reeval's sentence, e.g. `Eval timed out after 600s`."),
  })
  .describe(
    'reeval to the runner: the trial was aborted, as `c.signal` aborts. Calls in flight reply with errors; the runner should stop the body and send `done`.',
  )

export const trialDoneSchema = z
  .strictObject({
    type: z.literal('done'),
    error: trialThrownSchema.optional().describe('What the body threw, if it threw.'),
    turnStatusRead: z
      .boolean()
      .optional()
      .describe(
        'True when the body read turn.status. False when a turn errored and status was never read.',
      ),
  })
  .describe(
    "The runner to reeval: the eval's body has finished. The trial's graders and record follow.",
  )

const CALL_KEYS = Object.fromEntries(
  trialCallSchema.options.map((o) => [o.shape.op.value, Object.keys(o.shape)]),
)
const OTHER_KEYS = [
  'id',
  'call',
  'turn',
  'value',
  ...decideStatePartSchema.options.flatMap((o) => Object.keys(o.shape)),
  ...Object.keys(captureSchema.shape),
  ...Object.keys(captureCallDataSchema.shape),
  'name',
  'text',
  'type',
  'port',
  'handle',
  'timeout',
  'ms',
]

/** What's wrong with a trial request a runner sent, by the field's path, or undefined. */
export const trialRequestProblem = (value: unknown): string | undefined =>
  dataProblem(trialRequestSchema, value, 'The trial request', (object) =>
    typeof object.op === 'string' ? (CALL_KEYS[object.op] ?? []) : OTHER_KEYS,
  )

const LIFECYCLE_KEYS = ['type', 'trial', 'file', 'body', 'reason', 'message', 'error', 'name']

/** What's wrong with a lifecycle message, by the field's path, or undefined. */
export const trialStartProblem = (value: unknown): string | undefined =>
  dataProblem(trialStartSchema, value, 'The trial start', (object) =>
    'role' in object ? Object.keys(cellSchema.shape) : ['id', 'cell', 'n', ...LIFECYCLE_KEYS],
  )
export const trialAbortProblem = (value: unknown): string | undefined =>
  dataProblem(trialAbortSchema, value, 'The trial abort', () => LIFECYCLE_KEYS)
export const trialDoneProblem = (value: unknown): string | undefined =>
  dataProblem(trialDoneSchema, value, 'The trial done', () => LIFECYCLE_KEYS)

export type TrialCall = z.infer<typeof trialCallSchema>
export type DecideCallData = z.infer<typeof decideCallDataSchema>
export type TrialStart = z.infer<typeof trialStartSchema>
export type TrialAbort = z.infer<typeof trialAbortSchema>
export type TrialDone = z.infer<typeof trialDoneSchema>
export type TrialRequest = z.infer<typeof trialRequestSchema>
export type TrialReply = z.infer<typeof trialReplySchema>

/** The protocol's named schemas, by their `$def` name in schema/protocol/. */
export const TRIAL_SCHEMAS: Record<string, z.ZodType> = {
  TrialRequest: trialRequestSchema,
  TrialCall: trialCallSchema,
  TrialReply: trialReplySchema,
  TrialError: trialErrorSchema,
  TrialThrown: trialThrownSchema,
  JSONValue: jsonValueSchema,
  TurnData: turnDataSchema,
  TurnStatus: turnStatusSchema,
  TrajectoryEvent: trajectoryEventSchema,
  TokenUsage: tokenUsageSchema,
  WebEventType: webEventTypeSchema,
  Diff: diffSchema,
  FileChange: fileChangeSchema,
  ExecResult: execResultSchema,
  ExecRetry: execRetrySchema,
  ExecEnv: execEnvSchema,
  Capture: captureSchema,
  CaptureWindow: captureWindowSchema,
  TrialStart: trialStartSchema,
  TrialAbort: trialAbortSchema,
  TrialDone: trialDoneSchema,
  Cell: cellSchema,
  CellRole: cellRoleSchema,
  CaptureCallData: captureCallDataSchema,
  CaptureInstruction: captureInstructionSchema,
  CaptureWait: captureWaitSchema,
  DecideCallData: decideCallDataSchema,
  DecideStatePart: decideStatePartSchema,
  DecideResult: decideResultSchema,
  Wait: waitSchema,
  Duration: durationSchema,
}

/** The schemas `TRIAL_SCHEMAS` shares with a hand-written type in src/types.ts, by its name. */
export const TRIAL_TYPES = [
  'TurnData',
  'TurnStatus',
  'TrajectoryEvent',
  'TokenUsage',
  'WebEventType',
  'Diff',
  'FileChange',
  'ExecResult',
  'ExecRetry',
  'ExecEnv',
  'Capture',
  'CaptureWindow',
  'Cell',
  'CellRole',
  'CaptureWait',
] as const
