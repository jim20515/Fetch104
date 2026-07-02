import { listJobs } from '../utils/scrape-jobs'

export default defineEventHandler(() => {
  return { jobs: listJobs() }
})
