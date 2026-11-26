// Harbor's ATIF trajectory models (`harbor.models.trajectories`, harbor 0.27.0) as Zod: every
// object refuses unknown keys, and each pydantic validator is a refinement here. `toAtif`'s output
// is held to it in the tests, and the drift workflow holds the same goldens to Harbor's own
// validator, so a change on either side shows up there.
import { z } from 'zod'

const extra = z.record(z.string(), z.unknown()).nullish()

const ISO =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ]([01]\d|2[0-3])(?::[0-5]\d(?::[0-5]\d(?:\.\d+)?)?)?(?:Z|[+-](?:[01]\d|2[0-3])(?::?[0-5]\d)?)?)?$/

/**
 * `datetime.fromisoformat` after `Z` becomes `+00:00`, as Harbor reads a step's timestamp, in the
 * extended format only (Python also takes `20260101T000000`, which reeval never writes).
 */
const isoTimestamp = z.string().refine((v) => {
  const m = ISO.exec(v)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  return mo >= 1 && mo <= 12 && d >= 1 && d <= new Date(Date.UTC(y, mo, 0)).getUTCDate()
}, 'Invalid ISO 8601 timestamp')

const imageSource = z.strictObject({
  media_type: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  path: z.string(),
})

const AUDIO_ALIASES: Record<string, string> = {
  'audio/mp3': 'audio/mpeg',
  'audio/mpga': 'audio/mpeg',
  'audio/x-mpeg': 'audio/mpeg',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/x-aac': 'audio/aac',
  'audio/x-flac': 'audio/flac',
  'audio/x-aiff': 'audio/aiff',
}

const audioSource = z.strictObject({
  media_type: z.preprocess(
    (v) =>
      typeof v === 'string' ? (AUDIO_ALIASES[v.trim().toLowerCase()] ?? v.trim().toLowerCase()) : v,
    z.enum([
      'audio/wav',
      'audio/mpeg',
      'audio/mp4',
      'audio/aac',
      'audio/ogg',
      'audio/flac',
      'audio/webm',
      'audio/aiff',
    ]),
  ),
  path: z.string(),
  duration_sec: z.number().min(0).nullish(),
})

const contentPart = z
  .strictObject({
    type: z.enum(['text', 'image', 'audio']),
    text: z.string().nullish(),
    source: z.union([imageSource, audioSource]).nullish(),
  })
  .superRefine((part, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message })
    if (part.type === 'text') {
      if (part.text == null) fail("'text' field is required when type='text'")
      if (part.source != null) fail("'source' field is not allowed when type='text'")
      return
    }
    if (part.source == null) return fail(`'source' field is required when type='${part.type}'`)
    if (part.text != null) fail(`'text' field is not allowed when type='${part.type}'`)
    const isImage = imageSource.safeParse(part.source).success
    if (isImage !== (part.type === 'image')) {
      fail(
        `type='${part.type}' requires a ${part.type === 'image' ? 'ImageSource' : 'AudioSource'}`,
      )
    }
  })

const content = z.union([z.string(), z.array(contentPart)])

const subagentTrajectoryRef = z
  .strictObject({
    trajectory_id: z.string().nullish(),
    session_id: z.string().nullish(),
    trajectory_path: z.string().nullish(),
    extra,
  })
  .refine(
    (ref) => ref.trajectory_id != null || ref.trajectory_path != null,
    'SubagentTrajectoryRef must be resolvable: set either `trajectory_id` or `trajectory_path`',
  )

const toolCall = z.strictObject({
  tool_call_id: z.string(),
  function_name: z.string(),
  arguments: z.record(z.string(), z.unknown()),
  extra,
})

const observationResult = z.strictObject({
  source_call_id: z.string().nullish(),
  content: content.nullish(),
  subagent_trajectory_ref: z.array(subagentTrajectoryRef).nullish(),
  extra,
})

const metrics = z.strictObject({
  prompt_tokens: z.number().int().nullish(),
  completion_tokens: z.number().int().nullish(),
  cached_tokens: z.number().int().nullish(),
  cost_usd: z.number().nullish(),
  prompt_token_ids: z.array(z.number().int()).nullish(),
  completion_token_ids: z.array(z.number().int()).nullish(),
  logprobs: z.array(z.number()).nullish(),
  extra,
})

const AGENT_ONLY = [
  'model_name',
  'reasoning_effort',
  'reasoning_content',
  'tool_calls',
  'metrics',
] as const

const step = z
  .strictObject({
    step_id: z.number().int().min(1),
    timestamp: isoTimestamp.nullish(),
    source: z.enum(['system', 'user', 'agent']),
    model_name: z.string().nullish(),
    reasoning_effort: z.union([z.string(), z.number()]).nullish(),
    message: content,
    reasoning_content: z.string().nullish(),
    tool_calls: z.array(toolCall).nullish(),
    observation: z.strictObject({ results: z.array(observationResult) }).nullish(),
    metrics: metrics.nullish(),
    is_copied_context: z.boolean().nullish(),
    llm_call_count: z.number().int().min(0).nullish(),
    extra,
  })
  .superRefine((s, ctx) => {
    if (s.source !== 'agent') {
      for (const field of AGENT_ONLY) {
        if (s[field] != null) {
          ctx.addIssue({
            code: 'custom',
            message: `Field '${field}' is only applicable when source is 'agent', but source is '${s.source}'`,
          })
        }
      }
    }
    if (s.llm_call_count === 0 && s.source === 'agent') {
      for (const field of ['metrics', 'reasoning_content'] as const) {
        if (s[field] != null) {
          ctx.addIssue({
            code: 'custom',
            message: `Field '${field}' must be absent when llm_call_count is 0`,
          })
        }
      }
    }
  })

const agent = z.strictObject({
  name: z.string(),
  version: z.string(),
  model_name: z.string().nullish(),
  tool_definitions: z.array(z.record(z.string(), z.unknown())).nullish(),
  extra,
})

const finalMetrics = z.strictObject({
  total_prompt_tokens: z.number().int().nullish(),
  total_completion_tokens: z.number().int().nullish(),
  total_cached_tokens: z.number().int().nullish(),
  total_cost_usd: z.number().nullish(),
  total_steps: z.number().int().min(0).nullish(),
  extra,
})

export const ATIF_VERSIONS = [
  'ATIF-v1.0',
  'ATIF-v1.1',
  'ATIF-v1.2',
  'ATIF-v1.3',
  'ATIF-v1.4',
  'ATIF-v1.5',
  'ATIF-v1.6',
  'ATIF-v1.7',
  'ATIF-v1.8',
] as const

type TrajectoryIn = {
  schema_version?: (typeof ATIF_VERSIONS)[number]
  session_id?: string | null
  trajectory_id?: string | null
  agent: z.infer<typeof agent>
  steps: Array<z.infer<typeof step>>
  notes?: string | null
  final_metrics?: z.infer<typeof finalMetrics> | null
  continued_trajectory_ref?: string | null
  extra?: Record<string, unknown> | null
  subagent_trajectories?: TrajectoryIn[] | null
}

export const trajectorySchema: z.ZodType<TrajectoryIn> = z.lazy(() =>
  z
    .strictObject({
      schema_version: z.enum(ATIF_VERSIONS).default('ATIF-v1.8'),
      session_id: z.string().nullish(),
      trajectory_id: z.string().nullish(),
      agent,
      steps: z.array(step).min(1),
      notes: z.string().nullish(),
      final_metrics: finalMetrics.nullish(),
      continued_trajectory_ref: z.string().nullish(),
      extra,
      subagent_trajectories: z.array(trajectorySchema).nullish(),
    })
    .superRefine((t, ctx) => {
      const fail = (message: string) => ctx.addIssue({ code: 'custom', message })
      t.steps.forEach((s, i) => {
        if (s.step_id !== i + 1) {
          fail(`steps[${i}].step_id: expected ${i + 1} (sequential from 1), got ${s.step_id}`)
        }
      })
      const seen = new Set<string>()
      t.subagent_trajectories?.forEach((sub, i) => {
        if (sub.trajectory_id == null) {
          fail(`subagent_trajectories[${i}].trajectory_id is required for embedded subagents`)
        } else if (seen.has(sub.trajectory_id)) {
          fail(`subagent_trajectories[${i}].trajectory_id '${sub.trajectory_id}' is not unique`)
        } else seen.add(sub.trajectory_id)
      })
      for (const s of t.steps) {
        const ids = new Set(s.tool_calls?.map((c) => c.tool_call_id))
        for (const r of s.observation?.results ?? []) {
          if (r.source_call_id != null && !ids.has(r.source_call_id)) {
            fail(
              `Observation result references source_call_id '${r.source_call_id}' which is not found in step ${s.step_id}'s tool_calls`,
            )
          }
        }
      }
    }),
)

/** An ATIF trajectory document. */
export type Trajectory = TrajectoryIn
export type Step = z.infer<typeof step>
export type ToolCall = z.infer<typeof toolCall>
export type ObservationResult = z.infer<typeof observationResult>
export type Metrics = z.infer<typeof metrics>
