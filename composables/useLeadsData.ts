import type { LeadSource, LeadsResponse } from '~/types/leads'

// 以固定 key 取用，app.vue 與各頁面共享同一份 async data，不會重複打 API
export const useLeadsData = () => {
  const { data, pending, error, refresh } = useFetch<LeadsResponse>('/api/leads', {
    key: 'leads',
    default: () => ({
      leads: [],
      total: 0,
      sources: [],
      industries: [],
      storage: 'sqlite'
    })
  })

  return {
    leads: computed(() => data.value?.leads ?? []),
    sources: computed<LeadSource[]>(() => data.value?.sources ?? []),
    industries: computed(() => data.value?.industries ?? []),
    leadsPending: pending,
    leadsError: error,
    refreshLeads: refresh
  }
}
