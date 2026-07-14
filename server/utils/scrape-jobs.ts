import { ensureSchema, escapeSql, execute, query } from './db'

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

export const ensureScrapeJobsTable = () => ensureSchema()

export const createJob = async (source: string, keywords: string[], profileName: string): Promise<number> => {
  await ensureScrapeJobsTable()

  const [{ id }] = await query<{ id: number }>(`
    INSERT INTO scrape_jobs (source, keywords, profile_name, status)
    VALUES ('${escapeSql(source)}', '${escapeSql(JSON.stringify(keywords))}', '${escapeSql(profileName)}', 'pending')
    RETURNING id;
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

export const updateJob = async (id: number, patch: JobPatch) => {
  const sets = ['updated_at = now()']

  if (patch.status) sets.push(`status = '${escapeSql(patch.status)}'`)
  if (patch.progressMessage !== undefined) sets.push(`progress_message = '${escapeSql(patch.progressMessage)}'`)
  if (patch.foundCount !== undefined) sets.push(`found_count = ${Number(patch.foundCount) || 0}`)
  if (patch.savedCount !== undefined) sets.push(`saved_count = ${Number(patch.savedCount) || 0}`)
  if (patch.errorMessage !== undefined) sets.push(`error_message = '${escapeSql(patch.errorMessage)}'`)

  await execute(`UPDATE scrape_jobs SET ${sets.join(', ')} WHERE id = ${id};`)
}

export const getJob = async (id: number): Promise<ScrapeJobRow | null> => {
  await ensureScrapeJobsTable()
  const rows = await query<RawScrapeJobRow>(`SELECT * FROM scrape_jobs WHERE id = ${id};`)

  return rows[0] ? rowToJob(rows[0]) : null
}

export const listJobs = async (limit = 20): Promise<ScrapeJobRow[]> => {
  await ensureScrapeJobsTable()
  const rows = await query<RawScrapeJobRow>(`SELECT * FROM scrape_jobs ORDER BY id DESC LIMIT ${limit};`)

  return rows.map(rowToJob)
}
