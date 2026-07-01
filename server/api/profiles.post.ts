import { upsertScoringProfile } from '../utils/scoring-profiles'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  upsertScoringProfile({
    name: body.name,
    description: body.description,
    companyKeywords: body.companyKeywords,
    businessKeywords: body.businessKeywords,
    excludeKeywords: body.excludeKeywords,
    proThreshold: body.proThreshold,
    observableThreshold: body.observableThreshold,
    proLabel: body.proLabel,
    observableLabel: body.observableLabel,
    generalLabel: body.generalLabel
  })

  return { ok: true }
})
