import { defineConfig } from 'drizzle-kit'
import { join } from 'node:path'

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data')

export default defineConfig({
  dialect: 'sqlite',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: join(DATA_DIR, 'app.db'),
  },
})
