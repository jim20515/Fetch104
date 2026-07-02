import { upsertLead } from '../utils/leads'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.company || !body?.source || !body?.website) {
    throw createError({
      statusCode: 400,
      statusMessage: 'company, source, and website are required'
    })
  }

  upsertLead({
    company: body.company,
    source: body.source,
    industry: body.industry || '活動會展',
    category: body.category,
    contact: body.contact,
    phone: body.phone,
    website: body.website,
    officialWebsite: body.officialWebsite,
    status: body.status,
    fitScore: body.fitScore,
    professionalScore: body.professionalScore,
    targetType: body.targetType || '一般活動',
    scoreReason: body.scoreReason,
    metadata: body.metadata
  })

  return { ok: true }
})
