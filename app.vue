<script setup lang="ts">
import {
  Building2,
  Database,
  Download,
  ExternalLink,
  Filter,
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Radar,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  Upload
} from '@lucide/vue'

type LeadSource = string

interface Lead {
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

interface ScoringProfile {
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

interface SourceInfo {
  id: string
  name: string
  supportsKeywordSearch: boolean
}

interface ScrapeJob {
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

const { data: leadResponse, pending: leadsPending, error: leadsError, refresh: refreshLeads } = await useFetch<{
  leads: Lead[]
  total: number
  sources: LeadSource[]
  industries: string[]
  storage: string
}>('/api/leads', {
  default: () => ({
    leads: [],
    total: 0,
    sources: [],
    industries: [],
    storage: 'sqlite'
  })
})

const { data: profileResponse, refresh: refreshProfiles } = await useFetch<{ profiles: ScoringProfile[] }>('/api/profiles', {
  default: () => ({ profiles: [] })
})

const { data: sourceResponse } = await useFetch<{ sources: SourceInfo[] }>('/api/sources', {
  default: () => ({ sources: [] })
})

const { data: jobResponse, refresh: refreshJobs } = await useFetch<{ jobs: ScrapeJob[] }>('/api/scrape-jobs', {
  default: () => ({ jobs: [] })
})

const leads = computed(() => leadResponse.value?.leads ?? [])
const sources = computed<LeadSource[]>(() => leadResponse.value?.sources ?? [])
const industries = computed(() => leadResponse.value?.industries ?? [])
const profiles = computed(() => profileResponse.value?.profiles ?? [])
const proLabels = computed(() => new Set(profiles.value.map((profile) => profile.proLabel)))
const observableLabels = computed(() => new Set(profiles.value.map((profile) => profile.observableLabel)))
const dataSources = computed(() => sourceResponse.value?.sources ?? [])
const recentJobs = computed(() => jobResponse.value?.jobs ?? [])

const metadataLabel = (industry: string | undefined, key: string) => {
  const profile = profiles.value.find((item) => item.name === industry)
  return profile?.metadataSchema.find((field) => field.key === key)?.label ?? key
}

const activeView = ref<'leads' | 'rules' | 'sources'>('leads')
const keyword = ref('')
const activeSource = ref<LeadSource | '全部'>('全部')
const activeIndustry = ref<string | '全部'>('全部')
const activeTargetType = ref<string>('全部')
const minScore = ref(45)
const currentPage = ref(1)
const pageSize = ref(8)
const pageSizeOptions = [5, 8, 12, 20]

const targetTypeOptions = computed(() => {
  const present = new Set(leads.value.map((lead) => lead.targetType).filter(Boolean) as string[])
  const ordered: string[] = []

  for (const profile of profiles.value) {
    if (present.has(profile.proLabel) && !ordered.includes(profile.proLabel)) ordered.push(profile.proLabel)
    if (present.has(profile.observableLabel) && !ordered.includes(profile.observableLabel)) ordered.push(profile.observableLabel)
  }

  for (const type of present) {
    if (!ordered.includes(type)) ordered.push(type)
  }

  return ['全部', ...ordered]
})

const filteredLeads = computed(() => {
  const term = keyword.value.trim().toLowerCase()

  return leads.value.filter((lead) => {
    const matchesKeyword = !term || [
      lead.company,
      lead.category,
      lead.contact,
      lead.source
    ].some((value) => value.toLowerCase().includes(term))

    return matchesKeyword
      && (activeSource.value === '全部' || lead.source === activeSource.value)
      && (activeIndustry.value === '全部' || lead.industry === activeIndustry.value)
      && (activeTargetType.value === '全部' || lead.targetType === activeTargetType.value)
      && (lead.professionalScore ?? lead.fitScore) >= minScore.value
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredLeads.value.length / pageSize.value)))

const pageStart = computed(() => {
  if (filteredLeads.value.length === 0) {
    return 0
  }

  return (currentPage.value - 1) * pageSize.value + 1
})

const pageEnd = computed(() => Math.min(currentPage.value * pageSize.value, filteredLeads.value.length))

const paginatedLeads = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value

  return filteredLeads.value.slice(start, start + pageSize.value)
})

const visiblePages = computed(() => {
  const pages = new Set([1, totalPages.value, currentPage.value])

  if (currentPage.value > 1) {
    pages.add(currentPage.value - 1)
  }

  if (currentPage.value < totalPages.value) {
    pages.add(currentPage.value + 1)
  }

  return Array.from(pages).sort((a, b) => a - b)
})

const goToPage = (page: number) => {
  currentPage.value = Math.min(Math.max(page, 1), totalPages.value)
}

watch([keyword, activeSource, activeIndustry, activeTargetType, minScore, pageSize], () => {
  currentPage.value = 1
})

const summary = computed(() => {
  const professionalLeads = leads.value.filter((lead) => lead.targetType && proLabels.value.has(lead.targetType)).length
  const observableLeads = leads.value.filter((lead) => lead.targetType && observableLabels.value.has(lead.targetType)).length
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recentCount = leads.value.filter((lead) => lead.createdAt && new Date(lead.createdAt).getTime() >= sevenDaysAgo).length

  return [
    { label: '名單總數', value: leads.value.length.toLocaleString(), hint: 'SQLite 本機資料' },
    { label: '高潛力名單', value: professionalLeads.toLocaleString(), hint: '優先開發' },
    { label: '可觀察名單', value: observableLeads.toLocaleString(), hint: '需人工確認' },
    { label: '產業設定', value: industries.value.length.toLocaleString(), hint: '評分規則分組' },
    { label: '近 7 天新增', value: recentCount.toLocaleString(), hint: '所有產業合計' }
  ]
})

const statusClass = (status: Lead['status']) => {
  return {
    '高意願': 'bg-teal-50 text-teal-700 ring-teal-200',
    '已聯絡': 'bg-amber-50 text-amber-700 ring-amber-200',
    '待開發': 'bg-slate-100 text-slate-700 ring-slate-200'
  }[status]
}

const targetTypeClass = (targetType?: string) => {
  if (targetType && proLabels.value.has(targetType)) return 'bg-teal-50 text-teal-700 ring-teal-200'
  return 'bg-amber-50 text-amber-700 ring-amber-200'
}

const emptyProfileForm = () => ({
  name: '',
  description: '',
  companyKeywords: '',
  businessKeywords: '',
  excludeKeywords: '',
  proThreshold: 70,
  observableThreshold: 45,
  proLabel: '專業廠商',
  observableLabel: '可觀察',
  generalLabel: '一般名單'
})

const profileForm = ref(emptyProfileForm())
const profileSaving = ref(false)
const profileError = ref('')

const splitKeywords = (value: string) => value.split(/[,、\n]/).map((item) => item.trim()).filter(Boolean)

const submitProfile = async () => {
  if (!profileForm.value.name.trim()) {
    profileError.value = '請輸入產業設定名稱'
    return
  }

  profileSaving.value = true
  profileError.value = ''

  try {
    await $fetch('/api/profiles', {
      method: 'POST',
      body: {
        name: profileForm.value.name.trim(),
        description: profileForm.value.description,
        companyKeywords: splitKeywords(profileForm.value.companyKeywords),
        businessKeywords: splitKeywords(profileForm.value.businessKeywords),
        excludeKeywords: splitKeywords(profileForm.value.excludeKeywords),
        proThreshold: Number(profileForm.value.proThreshold),
        observableThreshold: Number(profileForm.value.observableThreshold),
        proLabel: profileForm.value.proLabel,
        observableLabel: profileForm.value.observableLabel,
        generalLabel: profileForm.value.generalLabel
      }
    })

    await refreshProfiles()
    profileForm.value = emptyProfileForm()
  } catch (error: any) {
    profileError.value = error?.data?.statusMessage || '儲存失敗'
  } finally {
    profileSaving.value = false
  }
}

const deleteProfile = async (name: string) => {
  await $fetch(`/api/profiles/${encodeURIComponent(name)}`, { method: 'DELETE' })
  await refreshProfiles()
}

const scrapeForm = ref({ source: '', keywords: '', profile: '' })
const scrapeError = ref('')
const activeJob = ref<ScrapeJob | null>(null)
let pollTimer: ReturnType<typeof setTimeout> | null = null

const stopPolling = () => {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

const pollJob = async (jobId: number) => {
  const job = await $fetch<ScrapeJob>(`/api/scrape-jobs/${jobId}`)
  activeJob.value = job

  if (job.status === 'pending' || job.status === 'running') {
    pollTimer = setTimeout(() => pollJob(jobId), 2000)
    return
  }

  await Promise.all([refreshJobs(), refreshLeads()])
}

const startScrape = async () => {
  const keywords = splitKeywords(scrapeForm.value.keywords)

  if (!scrapeForm.value.source || !scrapeForm.value.profile || keywords.length === 0) {
    scrapeError.value = '請選擇來源、產業設定，並至少輸入一個關鍵字'
    return
  }

  scrapeError.value = ''
  stopPolling()

  try {
    const { jobId } = await $fetch<{ jobId: number }>('/api/scrape-jobs', {
      method: 'POST',
      body: { source: scrapeForm.value.source, keywords, profile: scrapeForm.value.profile }
    })

    await pollJob(jobId)
  } catch (error: any) {
    scrapeError.value = error?.data?.statusMessage || '觸發擷取失敗'
  }
}

onUnmounted(stopPolling)
</script>

<template>
  <main class="min-h-screen bg-surface">
    <aside class="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white xl:block">
      <div class="flex h-16 items-center gap-3 border-b border-line px-6">
        <div class="grid size-9 place-items-center rounded-md bg-teal text-white">
          <Radar :size="19" />
        </div>
        <div>
          <p class="text-sm font-semibold text-ink">活動名單雷達</p>
          <p class="text-xs text-muted">Lead Finder</p>
        </div>
      </div>

      <nav class="space-y-1 px-3 py-5">
        <button
          class="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium"
          :class="activeView === 'leads' ? 'bg-slate-100 text-ink' : 'text-muted hover:bg-slate-50'"
          @click="activeView = 'leads'"
        >
          <Target :size="17" />
          名單探索
        </button>
        <button
          class="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium"
          :class="activeView === 'sources' ? 'bg-slate-100 text-ink' : 'text-muted hover:bg-slate-50'"
          @click="activeView = 'sources'"
        >
          <Database :size="17" />
          資料來源
        </button>
        <button class="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted hover:bg-slate-50">
          <Building2 :size="17" />
          公司資料
        </button>
        <button
          class="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium"
          :class="activeView === 'rules' ? 'bg-slate-100 text-ink' : 'text-muted hover:bg-slate-50'"
          @click="activeView = 'rules'"
        >
          <SlidersHorizontal :size="17" />
          評分規則
        </button>
      </nav>
    </aside>

    <section class="xl:pl-64">
      <header class="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
        <div class="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div>
            <h1 class="text-xl font-semibold tracking-normal text-ink">潛在客戶名單</h1>
            <p class="text-sm text-muted">從活動平台、會展名錄與招募訊號整理高機率客戶。</p>
          </div>

          <div class="flex items-center gap-2">
            <button
              class="grid size-10 place-items-center rounded-md border border-line bg-white text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              title="重新整理"
              :disabled="leadsPending"
              @click="refreshLeads"
            >
              <RefreshCw :size="18" :class="leadsPending ? 'animate-spin' : ''" />
            </button>
            <button class="grid size-10 place-items-center rounded-md border border-line bg-white text-muted hover:text-ink" title="匯入名單">
              <Upload :size="18" />
            </button>
            <button class="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white hover:bg-slate-800">
              <Download :size="17" />
              匯出 CSV
            </button>
          </div>
        </div>
      </header>

      <div v-if="activeView === 'leads'" class="px-4 py-6 sm:px-6 lg:px-8">
        <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div
            v-for="item in summary"
            :key="item.label"
            class="rounded-md border border-line bg-white p-4 shadow-soft"
          >
            <p class="text-sm text-muted">{{ item.label }}</p>
            <div class="mt-2 flex items-end justify-between gap-4">
              <strong class="text-2xl font-semibold tracking-normal text-ink">{{ item.value }}</strong>
              <span class="text-xs text-muted">{{ item.hint }}</span>
            </div>
          </div>
        </section>

        <div
          v-if="leadsError"
          class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          SQLite 資料讀取失敗，請確認已執行 npm run db:import。
        </div>

        <section class="mt-6 rounded-md border border-line bg-white shadow-soft">
          <div class="grid gap-3 border-b border-line p-4 xl:grid-cols-[1fr_auto_auto_auto_auto]">
            <label class="relative block">
              <Search class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" :size="18" />
              <input
                v-model="keyword"
                class="h-11 w-full rounded-md border border-line bg-white pl-10 pr-3 text-sm outline-none ring-teal/20 placeholder:text-slate-400 focus:border-teal focus:ring-4"
                placeholder="搜尋公司、類型、Email 或來源"
              >
            </label>

            <div class="flex overflow-x-auto rounded-md border border-line bg-slate-50 p-1">
              <button
                v-for="source in ['全部', ...sources]"
                :key="source"
                class="h-9 whitespace-nowrap rounded px-3 text-sm font-medium"
                :class="activeSource === source ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'"
                @click="activeSource = source"
              >
                {{ source }}
              </button>
            </div>

            <div class="flex overflow-x-auto rounded-md border border-line bg-slate-50 p-1">
              <button
                v-for="industry in ['全部', ...industries]"
                :key="industry"
                class="h-9 whitespace-nowrap rounded px-3 text-sm font-medium"
                :class="activeIndustry === industry ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'"
                @click="activeIndustry = industry"
              >
                {{ industry }}
              </button>
            </div>

            <div class="flex overflow-x-auto rounded-md border border-line bg-slate-50 p-1">
              <button
                v-for="targetType in targetTypeOptions"
                :key="targetType"
                class="h-9 whitespace-nowrap rounded px-3 text-sm font-medium"
                :class="activeTargetType === targetType ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'"
                @click="activeTargetType = targetType"
              >
                {{ targetType }}
              </button>
            </div>

            <label class="flex h-11 items-center gap-3 rounded-md border border-line px-3 text-sm text-muted">
              <Filter :size="17" />
              <span>符合分數</span>
              <input
                v-model="minScore"
                class="w-24 accent-teal"
                type="range"
                min="0"
                max="95"
              >
              <strong class="w-7 text-right text-ink">{{ minScore }}</strong>
            </label>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full min-w-[1320px] border-collapse text-left">
              <thead>
                <tr class="border-b border-line bg-slate-50 text-xs uppercase text-muted">
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">公司</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">來源</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">類型</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">詳細資料</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">符合分數</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">聯絡資訊</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">產業設定</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">名單類型</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">連結</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="lead in paginatedLeads"
                  :key="lead.company"
                  class="border-b border-line last:border-0 hover:bg-slate-50"
                >
                  <td class="px-4 py-4">
                    <div class="flex items-center gap-3">
                      <div class="grid size-9 shrink-0 place-items-center rounded-md bg-slate-100 text-ink">
                        <Building2 :size="17" />
                      </div>
                      <div>
                        <p class="font-medium text-ink">{{ lead.company }}</p>
                        <p class="text-xs text-muted">{{ lead.website }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-4 py-4 text-sm text-ink">{{ lead.source }}</td>
                  <td class="whitespace-nowrap px-4 py-4 text-sm text-muted">{{ lead.category }}</td>
                  <td class="px-4 py-4">
                    <details v-if="lead.metadata && Object.keys(lead.metadata).length" class="text-sm">
                      <summary class="cursor-pointer text-teal-700">展開</summary>
                      <ul class="mt-2 space-y-1 text-xs text-muted" style="max-width:220px">
                        <li v-for="(value, key) in lead.metadata" :key="key">
                          <span class="text-ink">{{ metadataLabel(lead.industry, String(key)) }}</span>：{{ value }}
                        </li>
                      </ul>
                    </details>
                    <span v-else class="text-sm text-muted">—</span>
                  </td>
                  <td class="px-4 py-4">
                    <div class="flex items-center gap-3">
                      <div class="h-2 w-24 rounded-full bg-slate-200">
                        <div class="h-2 rounded-full bg-coral" :style="{ width: `${lead.professionalScore ?? lead.fitScore}%` }" />
                      </div>
                      <span class="text-sm font-semibold text-ink">{{ lead.professionalScore ?? lead.fitScore }}</span>
                    </div>
                    <p v-if="lead.scoreReason" class="mt-1 text-xs text-muted" style="max-width:220px; white-space:normal; line-height:1.4">
                      {{ lead.scoreReason }}
                    </p>
                  </td>
                  <td class="px-4 py-4">
                    <div class="space-y-1 text-sm text-muted">
                      <p class="flex items-center gap-2">
                        <Mail :size="14" />
                        {{ lead.contact }}
                      </p>
                      <p class="flex items-center gap-2">
                        <Phone :size="14" />
                        {{ lead.phone }}
                      </p>
                    </div>
                  </td>
                  <td class="whitespace-nowrap px-4 py-4 text-sm text-muted">{{ lead.industry ?? '—' }}</td>
                  <td class="px-4 py-4">
                    <span class="inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1" :class="targetTypeClass(lead.targetType)">
                      {{ lead.targetType }}
                    </span>
                  </td>
                  <td class="px-4 py-4">
                    <div class="flex flex-col gap-1">
                      <a
                        v-if="lead.officialWebsite"
                        class="inline-flex items-center gap-1.5 rounded-md border border-teal/40 bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
                        :href="lead.officialWebsite"
                        target="_blank"
                        title="官方網站"
                      >
                        <ExternalLink :size="13" />
                        官網
                      </a>
                      <a
                        class="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-muted hover:text-ink"
                        :href="lead.website"
                        target="_blank"
                        :title="lead.source + ' 頁面'"
                      >
                        <ExternalLink :size="13" />
                        {{ lead.source }}
                      </a>
                    </div>
                  </td>
                </tr>
                <tr v-if="paginatedLeads.length === 0">
                  <td colspan="9" class="px-4 py-12 text-center text-sm text-muted">
                    目前沒有符合條件的名單
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="flex flex-col gap-3 border-t border-line px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div class="flex flex-wrap items-center gap-3 text-sm text-muted">
              <span>
                顯示 {{ pageStart }}-{{ pageEnd }} 筆，共 {{ filteredLeads.length }} 筆
              </span>
              <label class="flex items-center gap-2">
                <span>每頁</span>
                <select
                  v-model="pageSize"
                  class="h-9 rounded-md border border-line bg-white px-2 text-sm text-ink outline-none focus:border-teal"
                >
                  <option
                    v-for="option in pageSizeOptions"
                    :key="option"
                    :value="option"
                  >
                    {{ option }}
                  </option>
                </select>
              </label>
            </div>

            <div class="flex items-center gap-1">
              <button
                class="grid size-9 place-items-center rounded-md border border-line bg-white text-muted disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:text-ink"
                title="上一頁"
                :disabled="currentPage === 1"
                @click="goToPage(currentPage - 1)"
              >
                <ChevronLeft :size="17" />
              </button>
              <button
                v-for="page in visiblePages"
                :key="page"
                class="h-9 min-w-9 rounded-md border px-3 text-sm font-medium"
                :class="currentPage === page ? 'border-ink bg-ink text-white' : 'border-line bg-white text-muted hover:text-ink'"
                @click="goToPage(page)"
              >
                {{ page }}
              </button>
              <button
                class="grid size-9 place-items-center rounded-md border border-line bg-white text-muted disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:text-ink"
                title="下一頁"
                :disabled="currentPage === totalPages"
                @click="goToPage(currentPage + 1)"
              >
                <ChevronRight :size="17" />
              </button>
            </div>
          </div>
        </section>

        <section class="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div class="rounded-md border border-line bg-white p-5 shadow-soft">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h2 class="text-base font-semibold text-ink">建議抓取順序</h2>
                <p class="mt-1 text-sm text-muted">先抓最貼近活動需求的來源，再用公司網站補聯絡資訊。</p>
              </div>
              <Sparkles class="text-coral" :size="20" />
            </div>

            <ol class="mt-5 space-y-3">
              <li class="flex gap-3">
                <span class="grid size-7 shrink-0 place-items-center rounded-md bg-teal text-sm font-semibold text-white">1</span>
                <p class="text-sm text-muted"><strong class="text-ink">活動平台主辦單位</strong>：ACCUPASS、KKTIX，需求最直接。</p>
              </li>
              <li class="flex gap-3">
                <span class="grid size-7 shrink-0 place-items-center rounded-md bg-ink text-sm font-semibold text-white">2</span>
                <p class="text-sm text-muted"><strong class="text-ink">會展與公關公司</strong>：常替客戶辦活動，成交機率高。</p>
              </li>
              <li class="flex gap-3">
                <span class="grid size-7 shrink-0 place-items-center rounded-md bg-coral text-sm font-semibold text-white">3</span>
                <p class="text-sm text-muted"><strong class="text-ink">104 招募訊號</strong>：找正在招活動企劃、會展、行銷職缺的公司。</p>
              </li>
            </ol>
          </div>

          <div class="rounded-md border border-line bg-white p-5 shadow-soft">
            <h2 class="text-base font-semibold text-ink">下一步 API 欄位</h2>
            <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
              <span class="rounded-md bg-slate-100 px-3 py-2 text-muted">company</span>
              <span class="rounded-md bg-slate-100 px-3 py-2 text-muted">source</span>
              <span class="rounded-md bg-slate-100 px-3 py-2 text-muted">industry</span>
              <span class="rounded-md bg-slate-100 px-3 py-2 text-muted">website</span>
              <span class="rounded-md bg-slate-100 px-3 py-2 text-muted">email</span>
              <span class="rounded-md bg-slate-100 px-3 py-2 text-muted">phone</span>
              <span class="rounded-md bg-slate-100 px-3 py-2 text-muted">fit_score</span>
              <span class="rounded-md bg-slate-100 px-3 py-2 text-muted">metadata</span>
            </div>
          </div>
        </section>
      </div>

      <div v-else-if="activeView === 'rules'" class="px-4 py-6 sm:px-6 lg:px-8">
        <section class="rounded-md border border-line bg-white p-5 shadow-soft">
          <h2 class="text-base font-semibold text-ink">產業評分規則</h2>
          <p class="mt-1 text-sm text-muted">
            每組「產業設定」定義公司關鍵字、業務關鍵字、排除關鍵字與門檻分數，抓取時用
            <code class="rounded bg-slate-100 px-1.5 py-0.5 text-xs">--profile=名稱</code>
            套用（例如 <code class="rounded bg-slate-100 px-1.5 py-0.5 text-xs">npm run fetch:leads -- --profile=資訊科技</code>）。
          </p>

          <div class="mt-5 space-y-3">
            <div
              v-for="profile in profiles"
              :key="profile.id"
              class="rounded-md border border-line p-4"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <p class="font-medium text-ink">{{ profile.name }}</p>
                    <span
                      v-if="profile.isBuiltin"
                      class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-muted ring-1 ring-line"
                    >內建</span>
                  </div>
                  <p class="mt-1 text-sm text-muted">{{ profile.description }}</p>
                </div>
                <button
                  v-if="!profile.isBuiltin"
                  class="grid size-9 place-items-center rounded-md border border-line text-muted hover:text-red-600"
                  title="刪除設定檔"
                  @click="deleteProfile(profile.name)"
                >
                  <Trash2 :size="16" />
                </button>
              </div>

              <div class="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p class="text-xs uppercase text-muted">公司關鍵字</p>
                  <p class="mt-1 text-ink">{{ profile.companyKeywords.join('、') || '—' }}</p>
                </div>
                <div>
                  <p class="text-xs uppercase text-muted">業務關鍵字</p>
                  <p class="mt-1 text-ink">{{ profile.businessKeywords.join('、') || '—' }}</p>
                </div>
                <div>
                  <p class="text-xs uppercase text-muted">排除關鍵字</p>
                  <p class="mt-1 text-ink">{{ profile.excludeKeywords.join('、') || '—' }}</p>
                </div>
              </div>

              <div class="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                <span>{{ profile.proLabel }} ≥ {{ profile.proThreshold }} 分</span>
                <span>{{ profile.observableLabel }} ≥ {{ profile.observableThreshold }} 分</span>
                <span>其餘標為「{{ profile.generalLabel }}」（不顯示）</span>
              </div>
            </div>
          </div>
        </section>

        <section class="mt-6 rounded-md border border-line bg-white p-5 shadow-soft">
          <h2 class="text-base font-semibold text-ink">新增自訂產業設定</h2>
          <p class="mt-1 text-sm text-muted">依你要找的產業，設定關鍵字與門檻分數。關鍵字用逗號或頓號分隔。</p>

          <div class="mt-4 grid gap-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-sm">
                <span class="text-muted">設定名稱</span>
                <input
                  v-model="profileForm.name"
                  class="mt-1 h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-teal"
                  placeholder="例如：資訊科技、餐飲加盟"
                >
              </label>
              <label class="block text-sm">
                <span class="text-muted">說明</span>
                <input
                  v-model="profileForm.description"
                  class="mt-1 h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-teal"
                  placeholder="這組設定要找什麼樣的公司"
                >
              </label>
            </div>

            <label class="block text-sm">
              <span class="text-muted">公司關鍵字（出現在公司名稱）</span>
              <textarea
                v-model="profileForm.companyKeywords"
                rows="2"
                class="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal"
                placeholder="資訊、軟體、科技、顧問"
              />
            </label>

            <label class="block text-sm">
              <span class="text-muted">業務關鍵字（出現在類別或名稱中代表符合業務）</span>
              <textarea
                v-model="profileForm.businessKeywords"
                rows="2"
                class="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal"
                placeholder="系統開發、雲端服務、資訊委外"
              />
            </label>

            <label class="block text-sm">
              <span class="text-muted">排除關鍵字（出現時直接扣分）</span>
              <textarea
                v-model="profileForm.excludeKeywords"
                rows="2"
                class="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal"
                placeholder="學校、醫院、政府機關"
              />
            </label>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-sm">
                <span class="text-muted">高分標籤（≥ 門檻分數）</span>
                <input
                  v-model="profileForm.proLabel"
                  class="mt-1 h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-teal"
                >
              </label>
              <label class="block text-sm">
                <span class="text-muted">中分標籤</span>
                <input
                  v-model="profileForm.observableLabel"
                  class="mt-1 h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-teal"
                >
              </label>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-sm">
                <span class="text-muted">高分門檻：{{ profileForm.proThreshold }}</span>
                <input v-model="profileForm.proThreshold" type="range" min="0" max="100" class="mt-2 w-full accent-teal">
              </label>
              <label class="block text-sm">
                <span class="text-muted">可觀察門檻：{{ profileForm.observableThreshold }}</span>
                <input v-model="profileForm.observableThreshold" type="range" min="0" max="100" class="mt-2 w-full accent-teal">
              </label>
            </div>

            <p v-if="profileError" class="text-sm text-red-600">{{ profileError }}</p>

            <div>
              <button
                class="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                :disabled="profileSaving"
                @click="submitProfile"
              >
                {{ profileSaving ? '儲存中…' : '儲存設定檔' }}
              </button>
            </div>
          </div>
        </section>
      </div>

      <div v-else class="px-4 py-6 sm:px-6 lg:px-8">
        <section class="rounded-md border border-line bg-white p-5 shadow-soft">
          <h2 class="text-base font-semibold text-ink">名單擷取</h2>
          <p class="mt-1 text-sm text-muted">選擇來源、輸入關鍵字，套用一組產業評分規則，系統會在背景擷取並自動評分存入名單。</p>

          <div class="mt-4 grid gap-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-sm">
                <span class="text-muted">資料來源</span>
                <select
                  v-model="scrapeForm.source"
                  class="mt-1 h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-teal"
                >
                  <option value="" disabled>請選擇來源</option>
                  <option
                    v-for="source in dataSources"
                    :key="source.id"
                    :value="source.id"
                  >
                    {{ source.name }}
                  </option>
                </select>
              </label>
              <label class="block text-sm">
                <span class="text-muted">產業評分設定</span>
                <select
                  v-model="scrapeForm.profile"
                  class="mt-1 h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-teal"
                >
                  <option value="" disabled>請選擇設定檔</option>
                  <option
                    v-for="profile in profiles"
                    :key="profile.id"
                    :value="profile.name"
                  >
                    {{ profile.name }}
                  </option>
                </select>
              </label>
            </div>

            <label class="block text-sm">
              <span class="text-muted">關鍵字（逗號或頓號分隔，會用來搜尋來源網站）</span>
              <textarea
                v-model="scrapeForm.keywords"
                rows="2"
                class="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal"
                placeholder="例如：公關、整合行銷、活動企劃"
              />
            </label>

            <p v-if="scrapeError" class="text-sm text-red-600">{{ scrapeError }}</p>

            <div>
              <button
                class="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                :disabled="activeJob?.status === 'pending' || activeJob?.status === 'running'"
                @click="startScrape"
              >
                {{ (activeJob?.status === 'pending' || activeJob?.status === 'running') ? '擷取中…' : '開始擷取' }}
              </button>
            </div>

            <div
              v-if="activeJob"
              class="rounded-md border border-line bg-slate-50 p-4 text-sm"
            >
              <div class="flex items-center justify-between">
                <span class="font-medium text-ink">工作 #{{ activeJob.id }}（{{ activeJob.status }}）</span>
                <span class="text-muted">找到 {{ activeJob.foundCount }} 筆，存入 {{ activeJob.savedCount }} 筆</span>
              </div>
              <p class="mt-1 text-muted">{{ activeJob.errorMessage || activeJob.progressMessage }}</p>
            </div>
          </div>
        </section>

        <section class="mt-6 rounded-md border border-line bg-white shadow-soft">
          <div class="border-b border-line p-4">
            <h2 class="text-base font-semibold text-ink">最近擷取紀錄</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr class="border-b border-line bg-slate-50 text-xs uppercase text-muted">
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">來源</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">關鍵字</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">產業設定</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">狀態</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">找到 / 存入</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">時間</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="job in recentJobs"
                  :key="job.id"
                  class="border-b border-line last:border-0"
                >
                  <td class="whitespace-nowrap px-4 py-3 text-ink">{{ job.source }}</td>
                  <td class="px-4 py-3 text-muted">{{ job.keywords.join('、') }}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-muted">{{ job.profileName }}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-muted">{{ job.status }}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-muted">{{ job.foundCount }} / {{ job.savedCount }}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-muted">{{ job.updatedAt }}</td>
                </tr>
                <tr v-if="recentJobs.length === 0">
                  <td colspan="6" class="px-4 py-12 text-center text-muted">尚無擷取紀錄</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  </main>
</template>
