import { escapeSql, executeSql, queryJson, type ScoringProfileRow } from './sqlite'

interface MetadataFieldSeed {
  key: string
  label: string
}

interface BuiltinProfileSeed {
  name: string
  description: string
  companyKeywords: string[]
  businessKeywords: string[]
  excludeKeywords: string[]
  proThreshold: number
  observableThreshold: number
  proLabel: string
  observableLabel: string
  generalLabel: string
  metadataSchema: MetadataFieldSeed[]
}

const BUILTIN_PROFILES: BuiltinProfileSeed[] = [
  {
    name: '活動會展',
    description: '活動主辦、會展、公關整合行銷公司',
    companyKeywords: ['公關', '整合行銷', '行銷', '品牌', '活動企劃', '活動公司', '會展', '展覽', '策展', '顧問', '管理', '培訓', '訓練', '學院', '教育', '講師', '社群', '協會', '商會', '人才', '職涯', '創業', '新創', '創意', '工作室', '有限公司', '股份有限公司'],
    businessKeywords: ['公關', '整合行銷', '活動企劃', '品牌活動', '企業講座', '企業培訓', '工作坊', '會展', '展覽', '論壇', '研討會', '講師', '人才培訓', '職涯', '創業'],
    excludeKeywords: ['市政府', '縣政府', '區公所', '衛生局', '消防局', '醫院', '學校', '國小', '國中', '高中', '大學', '里辦公處', '農會', '廟', '寺', '宗教', '運動會', '錦標賽', '盃', '夏令營', '旅遊', '登山', '羽球', '桌球', '托育', '報名表', '音樂營', '親子'],
    proThreshold: 70,
    observableThreshold: 45,
    proLabel: '專業主辦',
    observableLabel: '可觀察',
    generalLabel: '一般活動',
    metadataSchema: [
      { key: 'eventName', label: '活動名稱' },
      { key: 'eventUrl', label: '活動連結' },
      { key: 'latestEvent', label: '最近活動' },
      { key: 'eventCount', label: '活動數' }
    ]
  },
  {
    name: '資訊科技',
    description: '軟體開發、系統整合、雲端服務、資訊委外廠商',
    companyKeywords: ['資訊', '軟體', '科技', '系統整合', '雲端', '網路', 'App', '數位', '資安', '人工智慧', 'AI', '顧問', '有限公司', '股份有限公司'],
    businessKeywords: ['系統開發', '軟體開發', '網站建置', 'App開發', '雲端服務', 'SaaS', '資訊服務', '客製化開發', '系統維運', 'IT委外', '資安服務', '數位轉型', 'API整合'],
    excludeKeywords: ['市政府', '縣政府', '區公所', '衛生局', '消防局', '醫院', '學校', '國小', '國中', '高中', '大學', '里辦公處', '農會', '廟', '寺', '宗教', '補習班'],
    proThreshold: 70,
    observableThreshold: 45,
    proLabel: '專業廠商',
    observableLabel: '可觀察',
    generalLabel: '一般名單',
    metadataSchema: []
  }
]

export const ensureScoringProfilesTable = () => {
  executeSql(`
    CREATE TABLE IF NOT EXISTS scoring_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      is_builtin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)

  const existingColumns = new Set(queryJson<{ name: string }>('PRAGMA table_info(scoring_profiles);').map((row) => row.name))

  if (!existingColumns.has('metadata_schema')) {
    executeSql("ALTER TABLE scoring_profiles ADD COLUMN metadata_schema TEXT NOT NULL DEFAULT '[]';")
  }

  const existing = queryJson<{ name: string }>('SELECT name FROM scoring_profiles;').map((row) => row.name)

  for (const profile of BUILTIN_PROFILES) {
    if (existing.includes(profile.name)) continue

    executeSql(`
      INSERT INTO scoring_profiles (
        name, description, company_keywords, business_keywords, exclude_keywords,
        pro_threshold, observable_threshold, pro_label, observable_label, general_label, metadata_schema, is_builtin
      ) VALUES (
        '${escapeSql(profile.name)}',
        '${escapeSql(profile.description)}',
        '${escapeSql(JSON.stringify(profile.companyKeywords))}',
        '${escapeSql(JSON.stringify(profile.businessKeywords))}',
        '${escapeSql(JSON.stringify(profile.excludeKeywords))}',
        ${profile.proThreshold},
        ${profile.observableThreshold},
        '${escapeSql(profile.proLabel)}',
        '${escapeSql(profile.observableLabel)}',
        '${escapeSql(profile.generalLabel)}',
        '${escapeSql(JSON.stringify(profile.metadataSchema))}',
        1
      );
    `)
  }
}

interface RawProfileRow {
  id: number
  name: string
  description: string | null
  company_keywords: string
  business_keywords: string
  exclude_keywords: string
  pro_threshold: number
  observable_threshold: number
  pro_label: string
  observable_label: string
  general_label: string
  metadata_schema: string
  is_builtin: number
}

const rowToProfile = (row: RawProfileRow): ScoringProfileRow => ({
  id: row.id,
  name: row.name,
  description: row.description,
  companyKeywords: JSON.parse(row.company_keywords || '[]'),
  businessKeywords: JSON.parse(row.business_keywords || '[]'),
  excludeKeywords: JSON.parse(row.exclude_keywords || '[]'),
  proThreshold: row.pro_threshold,
  observableThreshold: row.observable_threshold,
  proLabel: row.pro_label,
  observableLabel: row.observable_label,
  generalLabel: row.general_label,
  metadataSchema: JSON.parse(row.metadata_schema || '[]'),
  isBuiltin: !!row.is_builtin
})

export const listScoringProfiles = (): ScoringProfileRow[] => {
  ensureScoringProfilesTable()
  const rows = queryJson<RawProfileRow>('SELECT * FROM scoring_profiles ORDER BY is_builtin DESC, name ASC;')
  return rows.map(rowToProfile)
}

export interface ScoringProfileInput {
  name: string
  description?: string
  companyKeywords?: string[]
  businessKeywords?: string[]
  excludeKeywords?: string[]
  proThreshold?: number
  observableThreshold?: number
  proLabel?: string
  observableLabel?: string
  generalLabel?: string
  metadataSchema?: { key: string, label: string }[]
}

export const upsertScoringProfile = (profile: ScoringProfileInput) => {
  ensureScoringProfilesTable()
  const existing = queryJson<{ is_builtin: number }>(`SELECT is_builtin FROM scoring_profiles WHERE name = '${escapeSql(profile.name)}';`)

  if (existing[0]?.is_builtin) {
    throw createError({ statusCode: 400, statusMessage: '內建設定檔不可修改，請另存新名稱' })
  }

  executeSql(`
    INSERT INTO scoring_profiles (
      name, description, company_keywords, business_keywords, exclude_keywords,
      pro_threshold, observable_threshold, pro_label, observable_label, general_label, metadata_schema, is_builtin, updated_at
    ) VALUES (
      '${escapeSql(profile.name)}',
      '${escapeSql(profile.description || '')}',
      '${escapeSql(JSON.stringify(profile.companyKeywords || []))}',
      '${escapeSql(JSON.stringify(profile.businessKeywords || []))}',
      '${escapeSql(JSON.stringify(profile.excludeKeywords || []))}',
      ${Number(profile.proThreshold) || 70},
      ${Number(profile.observableThreshold) || 45},
      '${escapeSql(profile.proLabel || '專業主辦')}',
      '${escapeSql(profile.observableLabel || '可觀察')}',
      '${escapeSql(profile.generalLabel || '一般活動')}',
      '${escapeSql(JSON.stringify(profile.metadataSchema || []))}',
      0,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(name) DO UPDATE SET
      description = excluded.description,
      company_keywords = excluded.company_keywords,
      business_keywords = excluded.business_keywords,
      exclude_keywords = excluded.exclude_keywords,
      pro_threshold = excluded.pro_threshold,
      observable_threshold = excluded.observable_threshold,
      pro_label = excluded.pro_label,
      observable_label = excluded.observable_label,
      general_label = excluded.general_label,
      metadata_schema = excluded.metadata_schema,
      updated_at = CURRENT_TIMESTAMP
    WHERE is_builtin = 0;
  `)
}

export const deleteScoringProfile = (name: string) => {
  ensureScoringProfilesTable()
  const existing = queryJson<{ is_builtin: number }>(`SELECT is_builtin FROM scoring_profiles WHERE name = '${escapeSql(name)}';`)

  if (existing.length === 0) return
  if (existing[0].is_builtin) {
    throw createError({ statusCode: 400, statusMessage: '內建設定檔不可刪除' })
  }

  executeSql(`DELETE FROM scoring_profiles WHERE name = '${escapeSql(name)}';`)
}
