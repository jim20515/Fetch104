import { escapeSql, executeSql, queryJson } from './sqlite'

export interface ScrapeJobRow {
  id: number
  source: string
  keywords: string[]
  profileName: string
  status: 'pending' | 'running' | 'done' | 'error'
  progressMessage: string | null
  foundCount: number
  savedCount: number
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

interface RawScrapeJobRow {
  id: number
  source: string
  keywords: string
  profile_name: string
  status: string
  progress_message: string | null
  found_count: number
  saved_count: number
  error_message: string | null
  created_at: string
  updated_at: string
}

const rowToJob = (row: RawScrapeJobRow): ScrapeJobRow => ({
  id: row.id,
  source: row.source,
  keywords: JSON.parse(row.keywords || '[]'),
  profileName: row.profile_name,
  status: row.status as ScrapeJobRow['status'],
  progressMessage: row.progress_message,
  foundCount: row.found_count,
  savedCount: row.saved_count,
  errorMessage: row.error_message,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

export const ensureScrapeJobsTable = () => {
  executeSql(`
    CREATE TABLE IF NOT EXISTS scrape_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '[]',
      profile_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress_message TEXT,
      found_count INTEGER NOT NULL DEFAULT 0,
      saved_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

export const createJob = (source: string, keywords: string[], profileName: string): number => {
  ensureScrapeJobsTable()

  // INSERT and last_insert_rowid() must run in the same sqlite3 invocation —
  // each executeSql/queryJson call opens a fresh connection, so a separate
  // SELECT afterwards would always see rowid 0.
  const [{ id }] = queryJson<{ id: number }>(`
    INSERT INTO scrape_jobs (source, keywords, profile_name, status)
    VALUES ('${escapeSql(source)}', '${escapeSql(JSON.stringify(keywords))}', '${escapeSql(profileName)}', 'pending');
    SELECT last_insert_rowid() as id;
  `)

  return id
}

export interface JobPatch {
  status?: ScrapeJobRow['status']
  progressMessage?: string
  foundCount?: number
  savedCount?: number
  errorMessage?: string
}

export const updateJob = (id: number, patch: JobPatch) => {
  const sets = ['updated_at = CURRENT_TIMESTAMP']

  if (patch.status) sets.push(`status = '${escapeSql(patch.status)}'`)
  if (patch.progressMessage !== undefined) sets.push(`progress_message = '${escapeSql(patch.progressMessage)}'`)
  if (patch.foundCount !== undefined) sets.push(`found_count = ${Number(patch.foundCount) || 0}`)
  if (patch.savedCount !== undefined) sets.push(`saved_count = ${Number(patch.savedCount) || 0}`)
  if (patch.errorMessage !== undefined) sets.push(`error_message = '${escapeSql(patch.errorMessage)}'`)

  executeSql(`UPDATE scrape_jobs SET ${sets.join(', ')} WHERE id = ${id};`)
}

export const getJob = (id: number): ScrapeJobRow | null => {
  ensureScrapeJobsTable()
  const rows = queryJson<RawScrapeJobRow>(`SELECT * FROM scrape_jobs WHERE id = ${id};`)

  return rows[0] ? rowToJob(rows[0]) : null
}

export const listJobs = (limit = 20): ScrapeJobRow[] => {
  ensureScrapeJobsTable()
  const rows = queryJson<RawScrapeJobRow>(`SELECT * FROM scrape_jobs ORDER BY id DESC LIMIT ${limit};`)

  return rows.map(rowToJob)
}
