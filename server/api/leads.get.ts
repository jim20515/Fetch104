import { queryJson, type LeadRow } from '../utils/sqlite'

interface RawLeadRow {
  id: number
  company: string
  source: string
  category: string
  latest_event: string
  event_count: number
  fit_score: number
  contact: string
  phone: string
  website: string
  status: string
  event_name: string | null
  event_url: string | null
  professional_score: number
  target_type: string
  score_reason: string | null
  official_website: string | null
  created_at: string
  updated_at: string
}

export default defineEventHandler(() => {
  const rows = queryJson<RawLeadRow>(`
    SELECT
      id,
      company,
      source,
      category,
      latest_event,
      event_count,
      fit_score,
      contact,
      phone,
      website,
      status,
      event_name,
      event_url,
      professional_score,
      target_type,
      score_reason,
      official_website,
      created_at,
      updated_at
    FROM leads
    ORDER BY professional_score DESC, fit_score DESC, latest_event DESC, id DESC;
  `)

  const leads: LeadRow[] = rows.map((row) => ({
    id: row.id,
    company: row.company,
    source: row.source,
    category: row.category,
    latestEvent: row.latest_event,
    eventCount: row.event_count,
    fitScore: row.fit_score,
    contact: row.contact,
    phone: row.phone,
    website: row.website,
    status: row.status,
    eventName: row.event_name,
    eventUrl: row.event_url,
    professionalScore: row.professional_score,
    targetType: row.target_type,
    scoreReason: row.score_reason,
    officialWebsite: row.official_website,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))

  return {
    leads,
    total: leads.length,
    sources: Array.from(new Set(leads.map((lead) => lead.source))),
    storage: 'sqlite'
  }
})
