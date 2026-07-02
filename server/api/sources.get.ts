import { listSources } from '../utils/sources'

export default defineEventHandler(async () => {
  return { sources: await listSources() }
})
