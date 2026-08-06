import { z } from 'zod'
import type { RecipeDraft } from './parse'

const httpUrl = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol
    return protocol === 'http:' || protocol === 'https:'
  })

const outputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2_000).optional().nullable(),
  instructions: z.union([
    z.string().trim().min(1).max(50_000),
    z.array(z.string().trim().min(1).max(5_000)).min(1).max(100),
  ]),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  imageUrl: httpUrl.optional().nullable(),
})

function jsonObjectFrom(raw: string): string {
  const unfenced = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('LLM_INVALID_JSON')
  return unfenced.slice(start, end + 1)
}

export function parseLlmRecipeOutput(raw: string): RecipeDraft {
  if (raw.length > 100_000) throw new Error('LLM_OUTPUT_TOO_LARGE')
  let json: unknown
  try {
    json = JSON.parse(jsonObjectFrom(raw))
  } catch (error) {
    if ((error as Error).message === 'LLM_INVALID_JSON') throw error
    throw new Error('LLM_INVALID_JSON')
  }
  const parsed = outputSchema.safeParse(json)
  if (!parsed.success) throw new Error('LLM_INVALID_RECIPE')

  const instructions = Array.isArray(parsed.data.instructions)
    ? parsed.data.instructions
        .map((step, index) => `${index + 1}. ${step}`)
        .join('\n')
    : parsed.data.instructions
  return {
    name: parsed.data.name,
    description: parsed.data.description ?? '',
    instructions,
    tags: [...new Set(parsed.data.tags ?? [])].slice(0, 6),
    imageUrl: parsed.data.imageUrl ?? null,
  }
}
