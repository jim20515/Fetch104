import pg from 'pg'

const { Pool } = pg

export interface LeadRow {
  id: number
  company: string
  source: string
  industry: string
  category: string
  contact: string
  phone: string
  website: string
  officialWebsite: string | null
  status: string
  fitScore: number
  professionalScore: number
  targetType: string
  scoreReason: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ScoringProfileRow {
  id: number
  name: string
  description: string | null
  companyKeywords: string[]
  businessKeywords: string[]
  excludeKeywords: string[]
  proThreshold: number
  observableThreshold: number
  proLabel: string
  observableLabel: string
  generalLabel: string
  metadataSchema: { key: string, label: string }[]
  isBuiltin: boolean
}

let pool: pg.Pool | null = null

const getPool = () => {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL

    if (!connectionString) {
      throw createError({
        statusCode: 500,
        statusMessage: 'DATABASE_URL 未設定，請確認 .env 內含 Neon 連線字串'
      })
    }

    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5
    })
  }

  return pool
}

// JSON 欄位一律以 text 儲存 JSON 字串，讓呼叫端維持 JSON.parse(row.xxx) 的既有寫法；
// 時間欄位用 timestamptz，pg 會回傳 Date，序列化為 ISO 字串，前端 new Date() 可直接解析。
const SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS scoring_profiles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    company_keywords TEXT NOT NULL DEFAULT '[]',
    business_keywords TEXT NOT NULL DEFAULT '[]',
    exclude_keywords TEXT NOT NULL DEFAULT '[]',
    pro_threshold INTEGER NOT NULL DEFAULT 70,
    observable_threshold INTEGER NOT NULL DEFAULT 45,
    pro_label TEXT NOT NULL DEFAULT '專業主辦',
    observable_label TEXT NOT NULL DEFAULT '可觀察',
    general_label TEXT NOT NULL DEFAULT '一般活動',
    metadata_schema TEXT NOT NULL DEFAULT '[]',
    is_builtin SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    company TEXT NOT NULL,
    source TEXT NOT NULL,
    industry TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    contact TEXT NOT NULL DEFAULT '未公開',
    phone TEXT NOT NULL DEFAULT '未公開',
    website TEXT NOT NULL,
    official_website TEXT,
    status TEXT NOT NULL DEFAULT '待開發',
    fit_score INTEGER NOT NULL DEFAULT 0,
    professional_score INTEGER NOT NULL DEFAULT 0,
    target_type TEXT NOT NULL DEFAULT '',
    score_reason TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(source, company, website)
  );
  CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
  CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads(industry);
  CREATE INDEX IF NOT EXISTS idx_leads_fit_score ON leads(fit_score);
  CREATE INDEX IF NOT EXISTS idx_leads_professional_score ON leads(professional_score);
  CREATE INDEX IF NOT EXISTS idx_leads_target_type ON leads(target_type);

  CREATE TABLE IF NOT EXISTS scrape_jobs (
    id SERIAL PRIMARY KEY,
    source TEXT NOT NULL,
    keywords TEXT NOT NULL DEFAULT '[]',
    profile_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    progress_message TEXT,
    found_count INTEGER NOT NULL DEFAULT 0,
    saved_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`

let schemaReady: Promise<void> | null = null

// 一個 process 只建一次 schema，避免每個請求都往 Neon 打一次 DDL
export const ensureSchema = () => {
  if (!schemaReady) {
    schemaReady = getPool().query(SCHEMA_DDL).then(() => undefined)
  }

  return schemaReady
}

export const query = async <T>(sql: string): Promise<T[]> => {
  const result = await getPool().query(sql)
  return result.rows as T[]
}

export const execute = async (sql: string): Promise<void> => {
  await getPool().query(sql)
}

export const escapeSql = (value: unknown) => String(value ?? '').replaceAll("'", "''")
