import { deleteScoringProfile } from '../../utils/scoring-profiles'

export default defineEventHandler((event) => {
  const name = getRouterParam(event, 'name')

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  deleteScoringProfile(decodeURIComponent(name))

  return { ok: true }
})
