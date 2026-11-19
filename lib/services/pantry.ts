import 'server-only'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { pantryItems, type PantryItem } from '@/lib/db/schema'
import type { PantryInput } from '@/lib/pantry'
import { nowSec } from '@/lib/time'

/** 全部库存：先按快过期排序（没填保质期的排后），再按名称 */
export function listPantry(): PantryItem[] {
  const rows = db.select().from(pantryItems).orderBy(asc(pantryItems.name)).all()
  return rows.sort((a, b) => {
    if (a.expiresOn && b.expiresOn) return a.expiresOn.localeCompare(b.expiresOn)
    if (a.expiresOn) return -1
    if (b.expiresOn) return 1
    return a.name.localeCompare(b.name, 'zh')
  })
}

export function getPantryItem(id: string): PantryItem | undefined {
  return db.select().from(pantryItems).where(eq(pantryItems.id, id)).get()
}

export function createPantryItem(input: PantryInput, userId: string): PantryItem {
  return db
    .insert(pantryItems)
    .values({ ...input, createdBy: userId })
    .returning()
    .get()
}

export function updatePantryItem(
  id: string,
  patch: Partial<PantryInput>,
): PantryItem | undefined {
  return db
    .update(pantryItems)
    .set({ ...patch, updatedAt: nowSec() })
    .where(eq(pantryItems.id, id))
    .returning()
    .get()
}

export function deletePantryItem(id: string): boolean {
  return db.delete(pantryItems).where(eq(pantryItems.id, id)).run().changes > 0
}
