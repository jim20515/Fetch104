import { listScoringProfiles } from '../utils/scoring-profiles'

export default defineEventHandler(() => {
  return { profiles: listScoringProfiles() }
})
