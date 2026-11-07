import 'server-only'
import { AUTH_SECRET, UPLOAD_DIR } from '@/lib/env'
import { deleteImage, saveImage } from '@/lib/images'
import {
  cleanupExpiredImportFiles,
  promoteImportFile,
} from './import-image-files'
import {
  createImportImageToken,
  verifyImportImageToken,
} from './image-token'

const IMPORT_TTL_MS = 30 * 60 * 1000
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
const globalForImportCleanup = globalThis as unknown as {
  importImageCleanupTimer?: NodeJS.Timeout
}

export async function cleanupTemporaryImportImages(): Promise<void> {
  await cleanupExpiredImportFiles(UPLOAD_DIR, IMPORT_TTL_MS)
}

export function startTemporaryImportImageCleanup(): void {
  if (globalForImportCleanup.importImageCleanupTimer) return
  void cleanupTemporaryImportImages()
  const timer = setInterval(() => {
    void cleanupTemporaryImportImages()
  }, CLEANUP_INTERVAL_MS)
  timer.unref()
  globalForImportCleanup.importImageCleanupTimer = timer
}

export async function saveTemporaryImportImage(
  buffer: Buffer,
  userId: string,
): Promise<{ token: string; previewPath: string }> {
  await cleanupTemporaryImportImages()
  const previewPath = await saveImage(buffer, 'imports')
  const token = createImportImageToken(
    {
      userId,
      path: previewPath,
      expiresAt: Date.now() + IMPORT_TTL_MS,
    },
    AUTH_SECRET,
  )
  return { token, previewPath }
}

export async function consumeTemporaryImportImage(
  token: string,
  userId: string,
): Promise<string> {
  const grant = verifyImportImageToken(token, userId, AUTH_SECRET)
  return promoteImportFile(UPLOAD_DIR, grant.path)
}

export async function discardTemporaryImportImage(
  token: string | null | undefined,
  userId: string,
): Promise<void> {
  if (!token) return
  try {
    const grant = verifyImportImageToken(token, userId, AUTH_SECRET)
    await deleteImage(grant.path)
  } catch {
    // Invalid, expired, or already-consumed tokens are safe to ignore.
  }
}
