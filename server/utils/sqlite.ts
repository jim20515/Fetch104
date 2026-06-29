import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const dbPath = fileURLToPath(new URL('../../data/leads.sqlite', import.meta.url))

export interface LeadRow {
  id: number
  company: string
  source: string
  category: string
  latestEvent: string
  eventCount: number
  fitScore: number
  contact: string
  phone: string
  website: string
  status: string
  eventName: string | null
  eventUrl: string | null
  professionalScore: number
  targetType: string
  scoreReason: string | null
  officialWebsite: string | null
  createdAt: string
  updatedAt: string
}

const runSqlite = (args: string[], input?: string) => {
  if (!existsSync(dbPath)) {
    throw createError({
      statusCode: 500,
      statusMessage: 'SQLite database not found. Run: npm run db:import'
    })
  }

  const result = spawnSync('sqlite3', args, {
    input,
    encoding: 'utf8'
  })

  if (result.status !== 0) {
    throw createError({
      statusCode: 500,
      statusMessage: result.stderr || 'SQLite command failed'
    })
  }

  return result.stdout
}

export const queryJson = <T>(sql: string): T[] => {
  const output = runSqlite(['-json', dbPath, sql])

  return JSON.parse(output || '[]') as T[]
}

export const executeSql = (sql: string) => {
  runSqlite([dbPath], sql)
}

export const escapeSql = (value: unknown) => String(value ?? '').replaceAll("'", "''")
