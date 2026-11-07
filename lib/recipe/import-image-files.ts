import { randomUUID } from 'node:crypto'
import { mkdir, readdir, rename, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'

const IMPORT_PATH =
  /^imports\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i

export async function cleanupExpiredImportFiles(
  uploadDir: string,
  maxAgeMs: number,
  now = Date.now(),
): Promise<void> {
  const dir = join(uploadDir, 'imports')
  await mkdir(dir, { recursive: true })
  const files = await readdir(dir)
  await Promise.all(
    files.map(async (file) => {
      const path = join(dir, file)
      try {
        const info = await stat(path)
        if (info.isFile() && now - info.mtimeMs > maxAgeMs) {
          await unlink(path)
        }
      } catch {
        // Cleanup is opportunistic and must tolerate concurrent promotion.
      }
    }),
  )
}

export async function promoteImportFile(
  uploadDir: string,
  temporaryPath: string,
): Promise<string> {
  if (!IMPORT_PATH.test(temporaryPath)) {
    throw new Error('INVALID_IMPORT_IMAGE_PATH')
  }
  const dishesDir = join(uploadDir, 'dishes')
  await mkdir(dishesDir, { recursive: true })
  const filename = `${randomUUID()}.webp`
  await rename(join(uploadDir, temporaryPath), join(dishesDir, filename))
  return `dishes/${filename}`
}
