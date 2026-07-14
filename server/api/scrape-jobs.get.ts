import { listJobs } from '../utils/scrape-jobs'

export default defineEventHandler(async () => {
  return { jobs: await listJobs() }
})
