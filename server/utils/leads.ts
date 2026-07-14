import { ensureSchema, escapeSql, execute } from './db'

export interface UpsertLeadInput {
  company: string
  source: string
  industry?: string
  category?: string
  contact?: string
  phone?: string
  website: string
  officialWebsite?: string | null
  status?: string
  fitScore?: number
  professionalScore?: number
  targetType?: string
  scoreReason?: string | null
  metadata?: Record<string, unknown>
}

// 只有 null/undefined 轉為 NULL；空字串保留為 ''，以滿足 NOT NULL DEFAULT '' 欄位
const sqlValue = (value: unknown) => value == null ? 'NULL' : `'${escapeSql(value)}'`

export const upsertLead = async (lead: UpsertLeadInput) => {
  await ensureSchema()
  await execute(`
    INSERT INTO leads (
      company, source, industry, category, contact, phone, website, official_website, status,
      fit_score, professional_score, target_type, score_reason, metadata, updated_at
    ) VALUES (
      ${sqlValue(lead.company)},
      ${sqlValue(lead.source)},
      ${sqlValue(lead.industry || '')},
      ${sqlValue(lead.category || '')},
      ${sqlValue(lead.contact || '未公開')},
      ${sqlValue(lead.phone || '未公開')},
      ${sqlValue(lead.website)},
      ${sqlValue(lead.officialWebsite)},
      ${sqlValue(lead.status || '待開發')},
      ${Number(lead.fitScore) || 0},
      ${Number(lead.professionalScore) || 0},
      ${sqlValue(lead.targetType || '')},
      ${sqlValue(lead.scoreReason)},
      ${sqlValue(JSON.stringify(lead.metadata || {}))},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(source, company, website) DO UPDATE SET
      industry = excluded.industry,
      category = excluded.category,
      contact = excluded.contact,
      phone = excluded.phone,
      official_website = excluded.official_website,
      status = excluded.status,
      fit_score = excluded.fit_score,
      professional_score = excluded.professional_score,
      target_type = excluded.target_type,
      score_reason = excluded.score_reason,
      metadata = excluded.metadata,
      updated_at = CURRENT_TIMESTAMP;
  `)
}
