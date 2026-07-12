import type { ScoringProfile } from '~/types/leads'

export const useProfiles = () => {
  const { data, refresh } = useFetch<{ profiles: ScoringProfile[] }>('/api/profiles', {
    key: 'profiles',
    default: () => ({ profiles: [] })
  })

  const profiles = computed(() => data.value?.profiles ?? [])
  const proLabels = computed(() => new Set(profiles.value.map((profile) => profile.proLabel)))
  const observableLabels = computed(() => new Set(profiles.value.map((profile) => profile.observableLabel)))

  const metadataLabel = (industry: string | undefined, key: string) => {
    const profile = profiles.value.find((item) => item.name === industry)
    return profile?.metadataSchema.find((field) => field.key === key)?.label ?? key
  }

  return {
    profiles,
    proLabels,
    observableLabels,
    metadataLabel,
    refreshProfiles: refresh
  }
}

export const splitKeywords = (value: string) =>
  value.split(/[,、\n]/).map((item) => item.trim()).filter(Boolean)
