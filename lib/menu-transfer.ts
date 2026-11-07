import 'server-only'
import { readFile } from 'node:fs/promises'
import { join, normalize } from 'node:path'
import { unzipSync, zipSync, strToU8, strFromU8, type Unzipped } from 'fflate'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { dishes } from '@/lib/db/schema'
import { UPLOAD_DIR } from '@/lib/env'
import { saveImage, deleteImage } from '@/lib/images'
import { getSettings } from '@/lib/settings'

/**
 * 菜单导出 / 导入（分享给亲友、换设备、批量建库）。
 *
 * 导出：gancook-menu.zip = gancook-menu.json + images/*.webp
 * 导入支持：
 *  1. GanCook 导出的 .zip / .json
 *  2. 只有图片的 .zip：每张图一道菜，文件名即菜名，所在文件夹名即标签（荤菜/红烧肉.jpg）
 *  3. .txt / .csv：每行一道菜，「菜名 标签 标签」或「菜名,标签,标签」
 * 同名菜（忽略大小写）跳过；若原菜没图而导入的有图，则补上图片。
 */

export const MANIFEST = 'gancook-menu.json'
export const MAX_IMPORT_BYTES = 60 * 1024 * 1024
const MAX_DISHES = 500
const MAX_ENTRY_BYTES = 15 * 1024 * 1024
const MAX_TOTAL_UNZIPPED = 300 * 1024 * 1024
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|tiff?)$/i

const manifestSchema = z.object({
  app: z.literal('gancook').optional(),
  version: z.number().int().optional(),
  dishes: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().nullish(),
        instructions: z.string().nullish(),
        tags: z.array(z.string()).nullish(),
        archived: z.boolean().optional(),
        image: z.string().nullish(),
      }),
    )
    .max(MAX_DISHES),
})

type ImportDish = {
  name: string
  description: string | null
  instructions: string | null
  tags: string[]
  archived: boolean
  image: Uint8Array | null
  /** 来自「图片压缩包」：图片就是这道菜本身，图片读不了就不建这道菜 */
  imageOnly?: boolean
}

export type ImportResult = {
  created: number
  skipped: number
  imagesAdded: number
  failedImages: number
}

export class ImportError extends Error {
  constructor(public code: 'TOO_LARGE' | 'UNSUPPORTED' | 'BAD_FILE' | 'EMPTY') {
    super(code)
  }
}

// ── 导出 ──

export async function buildMenuExport(): Promise<{ zip: Uint8Array; count: number }> {
  const rows = db.select().from(dishes).orderBy(asc(dishes.createdAt)).all()
  const files: Record<string, Uint8Array> = {}
  const list = []
  let n = 0
  for (const d of rows) {
    let image: string | null = null
    if (d.imagePath) {
      const safe = normalize(d.imagePath)
      if (!safe.startsWith('..')) {
        try {
          const buf = await readFile(join(UPLOAD_DIR, safe))
          image = `images/${String(++n).padStart(3, '0')}.webp`
          files[image] = new Uint8Array(buf)
        } catch {
          // 图片文件丢失：仍导出文字信息
        }
      }
    }
    list.push({
      name: d.name,
      description: d.description,
      instructions: d.instructions,
      tags: d.tags ?? [],
      archived: d.status === 'archived',
      image,
    })
  }
  const manifest = {
    app: 'gancook',
    version: 1,
    exportedAt: new Date().toISOString(),
    family: getSettings().familyName,
    dishes: list,
  }
  files[MANIFEST] = strToU8(JSON.stringify(manifest, null, 2))
  // 图片已是 webp，再压缩没意义：level 0 直接存储，导出更快
  return { zip: zipSync(files, { level: 0 }), count: rows.length }
}

// ── 导入 ──

const clean = (s: string | null | undefined, max: number) =>
  (s ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max) || null

function cleanTags(tags: (string | null | undefined)[]): string[] {
  return [
    ...new Set(
      tags
        .map((t) => (t ?? '').trim().slice(0, 12))
        .filter((t) => t && !/^\d+$/.test(t)),
    ),
  ].slice(0, 6)
}

function safeUnzip(buf: Uint8Array): Unzipped {
  let total = 0
  try {
    return unzipSync(buf, {
      filter(file) {
        const name = file.name
        if (name.endsWith('/') || name.startsWith('__MACOSX/') || /(^|\/)\./.test(name))
          return false
        if (name !== MANIFEST && !name.endsWith(`/${MANIFEST}`) && !IMAGE_EXT.test(name))
          return false
        // 防 zip 炸弹：按头部声明的解压后大小把关
        if (file.originalSize > MAX_ENTRY_BYTES) return false
        total += file.originalSize
        if (total > MAX_TOTAL_UNZIPPED) throw new ImportError('TOO_LARGE')
        return true
      },
    })
  } catch (e) {
    if (e instanceof ImportError) throw e
    throw new ImportError('BAD_FILE')
  }
}

function fromManifest(json: unknown, files: Unzipped | null, base = ''): ImportDish[] {
  const parsed = manifestSchema.safeParse(json)
  if (!parsed.success) throw new ImportError('BAD_FILE')
  return parsed.data.dishes.map((d) => {
    const imgKey = d.image ? base + d.image.replace(/^\.?\//, '') : null
    return {
      name: d.name.trim().slice(0, 30),
      description: clean(d.description, 200),
      instructions: clean(d.instructions, 50_000),
      tags: cleanTags(d.tags ?? []),
      archived: Boolean(d.archived),
      image: imgKey && files?.[imgKey] ? files[imgKey] : null,
    }
  })
}

function fromImageFolder(files: Unzipped): ImportDish[] {
  const paths = Object.keys(files)
    .filter((k) => IMAGE_EXT.test(k))
    .sort((a, b) => a.localeCompare(b, 'zh'))
    .slice(0, MAX_DISHES)
  // 「右键压缩文件夹」会多包一层同名目录：所有图片都在同一个顶层目录下时，这层不当标签
  const roots = new Set(paths.map((p) => (p.includes('/') ? p.split('/')[0] : '')))
  const strip = roots.size === 1 && !roots.has('') ? 1 : 0
  return paths.map((path) => {
    const parts = path.split('/')
    const file = parts.pop()!
    const name = file.replace(IMAGE_EXT, '').replace(/[_\-]+/g, ' ').trim().slice(0, 30)
    return {
      name,
      description: null,
      instructions: null,
      tags: cleanTags(parts.slice(strip)),
      archived: false,
      image: files[path],
      imageOnly: true,
    }
  })
}

function fromText(text: string): ImportDish[] {
  return text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .slice(0, MAX_DISHES)
    .map((line) => {
      const cols = line.includes(',') || line.includes('，')
        ? line.split(/[,，]/)
        : line.split(/\s+/)
      const [name, ...tags] = cols.map((c) => c.replace(/^"|"$/g, '').trim())
      return {
        name: name.slice(0, 30),
        description: null,
        instructions: null,
        tags: cleanTags(tags),
        archived: false,
        image: null,
      }
    })
    // 跳过 CSV 表头
    .filter((d, i) => !(i === 0 && /^(name|菜名|名称)$/i.test(d.name)))
}

export function parseImportFile(buf: Uint8Array, filename: string): ImportDish[] {
  if (buf.byteLength > MAX_IMPORT_BYTES) throw new ImportError('TOO_LARGE')
  const lower = filename.toLowerCase()
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b // "PK"

  let list: ImportDish[]
  if (isZip) {
    const files = safeUnzip(buf)
    const manifestKey = Object.keys(files).find(
      (k) => k === MANIFEST || k.endsWith(`/${MANIFEST}`),
    )
    if (manifestKey) {
      const base = manifestKey.slice(0, manifestKey.length - MANIFEST.length)
      let json: unknown
      try {
        json = JSON.parse(strFromU8(files[manifestKey]))
      } catch {
        throw new ImportError('BAD_FILE')
      }
      list = fromManifest(json, files, base)
    } else {
      list = fromImageFolder(files)
    }
  } else if (lower.endsWith('.json')) {
    try {
      list = fromManifest(JSON.parse(strFromU8(buf)), null)
    } catch (e) {
      if (e instanceof ImportError) throw e
      throw new ImportError('BAD_FILE')
    }
  } else if (lower.endsWith('.txt') || lower.endsWith('.csv')) {
    list = fromText(strFromU8(buf))
  } else {
    throw new ImportError('UNSUPPORTED')
  }

  list = list.filter((d) => d.name)
  if (list.length === 0) throw new ImportError('EMPTY')
  return list
}

export async function importDishes(
  list: ImportDish[],
  userId: string,
): Promise<ImportResult> {
  const existing = new Map(
    db
      .select({ id: dishes.id, name: dishes.name, imagePath: dishes.imagePath })
      .from(dishes)
      .all()
      .map((d) => [d.name.trim().toLowerCase(), d]),
  )
  const result: ImportResult = { created: 0, skipped: 0, imagesAdded: 0, failedImages: 0 }
  const seen = new Set<string>()

  for (const d of list) {
    const key = d.name.toLowerCase()
    if (seen.has(key)) {
      result.skipped++
      continue
    }
    seen.add(key)

    let imagePath: string | null = null
    if (d.image) {
      try {
        imagePath = await saveImage(Buffer.from(d.image), 'dishes')
      } catch {
        result.failedImages++
        if (d.imageOnly) continue
      }
    }

    const prev = existing.get(key)
    if (prev) {
      if (!prev.imagePath && imagePath) {
        db.update(dishes).set({ imagePath }).where(eq(dishes.id, prev.id)).run()
        result.imagesAdded++
      } else {
        await deleteImage(imagePath)
        result.skipped++
      }
      continue
    }

    db.insert(dishes)
      .values({
        name: d.name,
        description: d.description,
        instructions: d.instructions,
        tags: d.tags,
        imagePath,
        status: d.archived ? 'archived' : 'active',
        createdBy: userId,
      })
      .run()
    result.created++
  }
  return result
}
