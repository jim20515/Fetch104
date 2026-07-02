export interface SourceInfo {
  id: string
  name: string
  supportsKeywordSearch: boolean
}

export interface RawLead {
  company: string
  source: string
  category: string
  fitScore: number
  contact: string
  phone: string
  website: string
  status: string
  metadata: Record<string, unknown>
}

interface SourceAdapter {
  id: string
  name: string
  supportsKeywordSearch: boolean
  search(keywords: string[], opts?: { onProgress?: (message: string) => void }): Promise<RawLead[]>
}

const sourcesModuleUrl = new URL('../../scripts/lib/sources/index.mjs', import.meta.url).href
const scoringModuleUrl = new URL('../../scripts/lib/scoring-profiles.mjs', import.meta.url).href

export const listSources = async (): Promise<SourceInfo[]> => {
  const mod = await import(/* @vite-ignore */ sourcesModuleUrl)
  return mod.listSources()
}

export const getSourceAdapter = async (id: string): Promise<SourceAdapter> => {
  const mod = await import(/* @vite-ignore */ sourcesModuleUrl)
  return mod.getSource(id)
}

export interface ScoreInput {
  company: string
  category?: string
  businessText?: string
  signalCount?: number
}

export const scoreLeadWithProfile = async (profile: unknown, lead: ScoreInput): Promise<{ score: number, targetType: string }> => {
  const mod = await import(/* @vite-ignore */ scoringModuleUrl)
  return mod.scoreWithProfile(profile, lead)
}
