'use server'

import { getCurrentUser } from '@/lib/auth/user'
import { getT } from '@/lib/i18n/server'
import { extractRecipeWithLlm } from '@/lib/llm/client'
import { getStoredLlmConfig } from '@/lib/llm/settings'
import { safeFetchResource } from '@/lib/recipe/fetch'
import { logRecipeImportFailure } from '@/lib/recipe/import-log'
import {
  discardTemporaryImportImage,
  saveTemporaryImportImage,
} from '@/lib/recipe/import-image'
import {
  extractRecipeFromHtml,
  htmlToVisibleText,
  isUsableRecipeDraft,
  organizeRecipeDraftWithLlm,
  parseRecipeJsonLd,
  type RecipeDraft,
} from '@/lib/recipe/parse'
import { extractHttpUrl } from '@/lib/recipe/url'

type ImportSuccess = {
  ok: true
  recipe: {
    name: string
    description: string
    instructions: string
    tags: string[]
    sourceUrl: string
    imageToken: string | null
    imagePreviewPath: string | null
    imageWarning: boolean
    llmWarning: boolean
  }
}

type ImportFailure = { ok: false; error: string }
export type ImportRecipeResult = ImportSuccess | ImportFailure

const globalForImports = globalThis as unknown as {
  recipeImportActive?: Set<string>
  recipeImportLastStart?: Map<string, number>
}
const activeImports =
  globalForImports.recipeImportActive ??
  (globalForImports.recipeImportActive = new Set())
const lastImportStart =
  globalForImports.recipeImportLastStart ??
  (globalForImports.recipeImportLastStart = new Map())

const EMPTY_RECIPE: RecipeDraft = {
  name: '',
  description: '',
  instructions: '',
  tags: [],
  imageUrl: null,
}

function claimImport(userId: string): boolean {
  const now = Date.now()
  if (
    activeImports.has(userId) ||
    now - (lastImportStart.get(userId) ?? 0) < 2_000
  ) {
    return false
  }
  activeImports.add(userId)
  lastImportStart.set(userId, now)
  return true
}

function parseFetchedRecipe(
  body: Buffer,
  contentType: string,
  finalUrl: string,
): { draft: RecipeDraft; visibleText: string } {
  const text = body.toString('utf8')
  if (
    contentType === 'application/json' ||
    contentType === 'application/ld+json'
  ) {
    try {
      return {
        draft: parseRecipeJsonLd(JSON.parse(text)) ?? EMPTY_RECIPE,
        visibleText: text.slice(0, 20_000),
      }
    } catch {
      return { draft: EMPTY_RECIPE, visibleText: text.slice(0, 20_000) }
    }
  }
  return {
    draft: extractRecipeFromHtml(text, finalUrl),
    visibleText: htmlToVisibleText(text),
  }
}

export async function importRecipeFromUrl(input: {
  shareText: string
  previousImageToken?: string | null
}): Promise<ImportRecipeResult> {
  const t = await getT()
  const me = await getCurrentUser()
  if (!me) return { ok: false, error: t('err.loginRequired') }
  if (!claimImport(me.id)) return { ok: false, error: t('err.importBusy') }

  try {
    const url = extractHttpUrl(input.shareText.slice(0, 2_000))
    if (!url) return { ok: false, error: t('err.recipeUrlRequired') }

    let page
    try {
      page = await safeFetchResource(url, 'html')
    } catch (error) {
      logRecipeImportFailure('page_fetch', url, error)
      return { ok: false, error: t('err.recipeFetchFailed') }
    }

    let parsed: ReturnType<typeof parseFetchedRecipe>
    try {
      parsed = parseFetchedRecipe(page.body, page.contentType, page.finalUrl)
    } catch (error) {
      logRecipeImportFailure('page_parse', url, error)
      return { ok: false, error: t('err.recipeParseFailed') }
    }
    const llmConfig = getStoredLlmConfig()
    const organized = await organizeRecipeDraftWithLlm(
      parsed.draft,
      llmConfig.enabled,
      async (structuredDraft) => {
        try {
          return await extractRecipeWithLlm(
            llmConfig,
            page.finalUrl,
            parsed.visibleText,
            structuredDraft,
          )
        } catch (error) {
          logRecipeImportFailure('llm_extract', llmConfig.baseUrl, error)
          throw error
        }
      },
    )
    const draft = organized.draft
    const llmWarning = organized.llmWarning

    if (!isUsableRecipeDraft(draft)) {
      return {
        ok: false,
        error: llmWarning
          ? t('err.recipeLlmFailed')
          : t('err.recipeParseFailed'),
      }
    }

    await discardTemporaryImportImage(input.previousImageToken, me.id)
    let imageToken: string | null = null
    let imagePreviewPath: string | null = null
    let imageWarning = false
    if (draft.imageUrl) {
      try {
        const image = await safeFetchResource(draft.imageUrl, 'image')
        const saved = await saveTemporaryImportImage(image.body, me.id)
        imageToken = saved.token
        imagePreviewPath = saved.previewPath
      } catch (error) {
        logRecipeImportFailure('image_fetch', draft.imageUrl, error)
        imageWarning = true
      }
    }

    return {
      ok: true,
      recipe: {
        name: draft.name.trim().slice(0, 30),
        description: draft.description.trim().slice(0, 200),
        instructions: draft.instructions.trim().slice(0, 50_000),
        tags: draft.tags
          .map((tag) => tag.trim().slice(0, 20))
          .filter(Boolean)
          .slice(0, 6),
        sourceUrl: page.finalUrl,
        imageToken,
        imagePreviewPath,
        imageWarning,
        llmWarning,
      },
    }
  } finally {
    activeImports.delete(me.id)
  }
}

export async function discardImportedRecipeImage(
  token: string | null,
): Promise<void> {
  const me = await getCurrentUser()
  if (!me) return
  await discardTemporaryImportImage(token, me.id)
}
