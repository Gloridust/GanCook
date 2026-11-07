export type RecipeImportStage = 'page_fetch' | 'llm_extract' | 'image_fetch'

function errorCode(error: unknown): string {
  const value =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : error instanceof Error
        ? error.message
        : ''
  return /^[A-Z][A-Z0-9_]{0,79}$/.test(value) ? value : 'UNKNOWN'
}

function hostnameFrom(target: string): string {
  try {
    return new URL(target).hostname
  } catch {
    return 'unknown'
  }
}

export function logRecipeImportFailure(
  stage: RecipeImportStage,
  target: string,
  error: unknown,
): void {
  console.error('[recipe-import]', {
    event: 'recipe_import_failed',
    stage,
    hostname: hostnameFrom(target),
    code: errorCode(error),
  })
}
