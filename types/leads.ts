export type LeadSource = string

export interface Lead {
  id?: number
  company: string
  source: LeadSource
  category: string
  fitScore: number
  contact: string
  phone: string
  website: string
  status: '待開發' | '已聯絡' | '高意願'
  professionalScore?: number
  targetType?: string
  scoreReason?: string | null
  officialWebsite?: string | null
  industry?: string
  metadata?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export interface ScoringProfile {
  id: number
  name: string
  description: string | null
  companyKeywords: string[]
  businessKeywords: string[]
  excludeKeywords: string[]
  proThreshold: number
  observableThreshold: number
  proLabel: string
  observableLabel: string
  generalLabel: string
  metadataSchema: { key: string, label: string }[]
  isBuiltin: boolean
}

export interface SourceInfo {
  id: string
  name: string
  supportsKeywordSearch: boolean
}

export interface ScrapeJob {
  id: number
  source: string
  keywords: string[]
  profileName: string
  status: 'pending' | 'running' | 'done' | 'error'
  progressMessage: string | null
  foundCount: number
  savedCount: number
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface LeadsResponse {
  leads: Lead[]
  total: number
  sources: LeadSource[]
  industries: string[]
  storage: string
}
