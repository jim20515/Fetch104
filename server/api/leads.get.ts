import { ensureSchema, query, type LeadRow } from '../utils/db'

interface RawLeadRow {
  id: number
  company: string
  source: string
  industry: string
  category: string
  contact: string
  phone: string
  website: string
  official_website: string | null
  status: string
  fit_score: number
  professional_score: number
  target_type: string
  score_reason: string | null
  metadata: string
  created_at: string
  updated_at: string
}

export default defineEventHandler(async () => {
  await ensureSchema()
  const rows = await query<RawLeadRow>(`
    SELECT
      id,
      company,
      source,
      industry,
      category,
      contact,
      phone,
      website,
      official_website,
      status,
      fit_score,
      professional_score,
      target_type,
      score_reason,
      metadata,
      created_at,
      updated_at
    FROM leads
    ORDER BY professional_score DESC, fit_score DESC, id DESC;
  `)

  const leads: LeadRow[] = rows.map((row) => ({
    id: row.id,
    company: row.company,
    source: row.source,
    industry: row.industry,
    category: row.category,
    contact: row.contact,
    phone: row.phone,
    website: row.website,
    officialWebsite: row.official_website,
    status: row.status,
    fitScore: row.fit_score,
    professionalScore: row.professional_score,
    targetType: row.target_type,
    scoreReason: row.score_reason,
    metadata: JSON.parse(row.metadata || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))

  return {
    leads,
    total: leads.length,
    sources: Array.from(new Set(leads.map((lead) => lead.source))),
    industries: Array.from(new Set(leads.map((lead) => lead.industry))),
    storage: 'neon'
  }
})
