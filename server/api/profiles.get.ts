import { listScoringProfiles } from '../utils/scoring-profiles'

export default defineEventHandler(async () => {
  return { profiles: await listScoringProfiles() }
})
