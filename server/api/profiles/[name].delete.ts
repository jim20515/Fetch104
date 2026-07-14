import { deleteScoringProfile } from '../../utils/scoring-profiles'

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name')

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  await deleteScoringProfile(decodeURIComponent(name))

  return { ok: true }
})
