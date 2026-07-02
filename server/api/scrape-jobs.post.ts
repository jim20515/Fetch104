import { upsertLead } from '../utils/leads'
import { listScoringProfiles } from '../utils/scoring-profiles'
import { createJob, updateJob } from '../utils/scrape-jobs'
import { getSourceAdapter, listSources, scoreLeadWithProfile } from '../utils/sources'
import type { ScoringProfileRow } from '../utils/sqlite'

async function runJob(jobId: number, sourceId: string, keywords: string[], profile: ScoringProfileRow) {
  updateJob(jobId, { status: 'running', progressMessage: '開始擷取' })

  const adapter = await getSourceAdapter(sourceId)
  const rawLeads = await adapter.search(keywords, {
    onProgress: (message) => updateJob(jobId, { progressMessage: message })
  })

  updateJob(jobId, { foundCount: rawLeads.length, progressMessage: `找到 ${rawLeads.length} 筆，評分中` })

  let saved = 0

  for (const lead of rawLeads) {
    const { score, targetType } = await scoreLeadWithProfile(profile, {
      company: lead.company,
      category: lead.category,
      businessText: typeof lead.metadata?.eventName === 'string' ? lead.metadata.eventName : '',
      signalCount: typeof lead.metadata?.eventCount === 'number' ? lead.metadata.eventCount : 1
    })

    if (targetType === profile.generalLabel) continue

    upsertLead({
      company: lead.company,
      source: lead.source,
      industry: profile.name,
      category: lead.category,
      contact: lead.contact,
      phone: lead.phone,
      website: lead.website,
      status: lead.status,
      fitScore: Math.min(99, Math.round((lead.fitScore * 0.55) + (score * 0.45))),
      professionalScore: score,
      targetType,
      metadata: lead.metadata
    })

    saved++
  }

  updateJob(jobId, {
    status: 'done',
    savedCount: saved,
    progressMessage: `完成，找到 ${rawLeads.length} 筆，存入 ${saved} 筆`
  })
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.source || !Array.isArray(body?.keywords) || body.keywords.length === 0 || !body?.profile) {
    throw createError({ statusCode: 400, statusMessage: 'source, keywords, profile are required' })
  }

  const sources = await listSources()

  if (!sources.some((source) => source.id === body.source)) {
    throw createError({ statusCode: 400, statusMessage: `找不到資料來源：${body.source}` })
  }

  const profile = listScoringProfiles().find((item) => item.name === body.profile)

  if (!profile) {
    throw createError({ statusCode: 400, statusMessage: `找不到評分設定檔：${body.profile}` })
  }

  const keywords = body.keywords.map((keyword: string) => String(keyword).trim()).filter(Boolean)
  const jobId = createJob(body.source, keywords, profile.name)

  runJob(jobId, body.source, keywords, profile).catch((error) => {
    updateJob(jobId, { status: 'error', errorMessage: error?.message || String(error) })
  })

  return { jobId }
})
