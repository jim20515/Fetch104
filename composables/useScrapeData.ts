import type { ScrapeJob, SourceInfo } from '~/types/leads'

export const useScrapeData = () => {
  const { data: sourceResponse } = useFetch<{ sources: SourceInfo[] }>('/api/sources', {
    key: 'sources',
    default: () => ({ sources: [] })
  })

  const { data: jobResponse, refresh: refreshJobs } = useFetch<{ jobs: ScrapeJob[] }>('/api/scrape-jobs', {
    key: 'scrape-jobs',
    default: () => ({ jobs: [] })
  })

  return {
    dataSources: computed(() => sourceResponse.value?.sources ?? []),
    recentJobs: computed(() => jobResponse.value?.jobs ?? []),
    refreshJobs
  }
}
