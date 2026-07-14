import { getJob } from '../../utils/scrape-jobs'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'invalid job id' })
  }

  const job = await getJob(id)

  if (!job) {
    throw createError({ statusCode: 404, statusMessage: 'job not found' })
  }

  return job
})
