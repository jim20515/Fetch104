<script setup lang="ts">
import {
  AlertCircle,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  ExternalLink,
  Filter,
  Mail,
  Phone,
  Radar,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  Upload,
  X
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
const activeSource = ref<string[]>([])
const activeIndustry = ref<string[]>([])
const filterSourceOpen = ref(false)
const filterIndustryOpen = ref(false)
const filterSourceRef = ref<HTMLElement | null>(null)
const filterIndustryRef = ref<HTMLElement | null>(null)
const activeTargetType = ref<string>('')
const minScore = ref(45)
const currentPage = ref(1)
const pageSize = ref(8)
const pageSizeOptions = [5, 8, 12, 20]


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
      && (activeSource.value.length === 0 || activeSource.value.includes(lead.source))
      && (activeIndustry.value.length === 0 || activeIndustry.value.includes(lead.industry ?? ''))
      && (!activeTargetType.value || (lead.targetType ?? '').includes(activeTargetType.value))
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

const scrapeForm = ref({ sources: [] as string[], keywords: '', profile: '' })
const sourceDropdownOpen = ref(false)

const SOURCE_KEYWORD_HINTS: Record<string, string> = {
  'salary.tw': '抓取固定的「廣告行銷公關業」頁面，關鍵字用來過濾公司名稱，名字含關鍵字的才留下',
  '104': '以關鍵字搜尋 104 職缺，從結果頁抓出刊登職缺的公司名稱',
  'gcis': '以關鍵字搜尋全國工商登記，每個關鍵字是一次獨立查詢，找名稱含該詞的公司',
  'yourator': '抓取 Yourator 上所有公司，以關鍵字過濾公司名稱或標籤（如整合行銷、公關顧問）',
  '518': '以關鍵字搜尋 518 熊班人力銀行職缺，從結果頁抓出刊登職缺的公司名稱',
}

const selectedSourceHints = computed(() =>
  scrapeForm.value.sources
    .map((id) => {
      const src = dataSources.value.find((s) => s.id === id)
      const hint = SOURCE_KEYWORD_HINTS[id]
      return src && hint ? { name: src.name, hint } : null
    })
    .filter(Boolean) as { name: string; hint: string }[]
)

const scrapeError = ref('')
const activeJobs = ref<ScrapeJob[]>([])
let pollTimers: Map<number, ReturnType<typeof setTimeout>> = new Map()

const stopPolling = () => {
  pollTimers.forEach((t) => clearTimeout(t))
  pollTimers.clear()
}

const pollJob = async (jobId: number) => {
  const job = await $fetch<ScrapeJob>(`/api/scrape-jobs/${jobId}`)
  const idx = activeJobs.value.findIndex((j) => j.id === jobId)
  if (idx >= 0) activeJobs.value[idx] = job
  else activeJobs.value.push(job)

  if (job.status === 'pending' || job.status === 'running') {
    const t = setTimeout(() => pollJob(jobId), 2000)
    pollTimers.set(jobId, t)
    return
  }

  pollTimers.delete(jobId)
  if (pollTimers.size === 0) {
    await Promise.all([refreshJobs(), refreshLeads()])
  }
}

const isRunning = computed(() =>
  activeJobs.value.some((j) => j.status === 'pending' || j.status === 'running')
)

const startScrape = async () => {
  const keywords = splitKeywords(scrapeForm.value.keywords)

  if (scrapeForm.value.sources.length === 0) {
    scrapeError.value = '請至少選擇一個資料來源'
    return
  }
  if (!scrapeForm.value.profile) {
    scrapeError.value = '請選擇產業評分設定'
    return
  }
  if (keywords.length === 0) {
    scrapeError.value = '請輸入至少一個關鍵字'
    return
  }

  scrapeError.value = ''
  stopPolling()
  activeJobs.value = []

  for (const source of scrapeForm.value.sources) {
    try {
      const { jobId } = await $fetch<{ jobId: number }>('/api/scrape-jobs', {
        method: 'POST',
        body: { source, keywords, profile: scrapeForm.value.profile }
      })
      activeJobs.value.push({ id: jobId, source, status: 'pending', progressMessage: '等待中', foundCount: 0, savedCount: 0, keywords, profileName: scrapeForm.value.profile, errorMessage: null, createdAt: '', updatedAt: '' })
      pollJob(jobId)
    } catch (error: any) {
      scrapeError.value = error?.data?.statusMessage || `${source} 觸發失敗`
    }
  }
}

onUnmounted(stopPolling)

const showBlockedModal = ref(false)

const BLOCKED_SOURCES = [
  {
    name: '1111 人力銀行',
    url: 'https://www.1111.com.tw',
    reason: '採用 JavaScript 單頁渲染，搜尋結果須在瀏覽器執行後才出現，伺服器端無法直接抓取。'
  },
  {
    name: '台灣黃頁（中華黃頁 iyp.com.tw）',
    url: 'https://www.iyp.com.tw',
    reason: '採用 JavaScript 單頁渲染，且搜尋 API 需要授權金鑰，伺服器端無法直接抓取。'
  },
  {
    name: '台灣就業通（taiwanjobs.gov.tw）',
    url: 'https://job.taiwanjobs.gov.tw',
    reason: '職缺資料透過 JavaScript 動態載入，伺服器端無法抓取。且平台以政府補助職缺、中高齡就業為主，與目標產業重疊度低。'
  },
  {
    name: 'yes123 求職網',
    url: 'https://www.yes123.com.tw',
    reason: '職缺搜尋結果採 JavaScript 渲染，伺服器端抓取到的僅為廣告橫幅，非實際職缺資料。'
  },
  {
    name: 'Adecco 藝珂人事',
    url: 'https://www.adecco.com/zh-tw',
    reason: '人力派遣公司，職缺為代替客戶刊登且不公開雇主名稱，無法作為 B2B 名單來源。網站同時採 JavaScript 渲染。'
  }
]

function handleClickOutside(e: MouseEvent) {
  if (filterSourceRef.value && !filterSourceRef.value.contains(e.target as Node)) {
    filterSourceOpen.value = false
  }
  if (filterIndustryRef.value && !filterIndustryRef.value.contains(e.target as Node)) {
    filterIndustryOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
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
              class="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm text-muted hover:text-ink"
              @click="showBlockedModal = true"
            >
              <AlertCircle :size="15" />
              無法擷取來源清單
            </button>
            <button
              class="grid size-10 place-items-center rounded-lg border border-line bg-white text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              title="重新整理"
              :disabled="leadsPending"
              @click="refreshLeads"
            >
              <RefreshCw :size="18" :class="leadsPending ? 'animate-spin' : ''" />
            </button>
            <button class="grid size-10 place-items-center rounded-lg border border-line bg-white text-muted hover:text-ink" title="匯入名單">
              <Upload :size="18" />
            </button>
            <button class="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-white hover:bg-slate-800">
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
            class="rounded-xl border border-line bg-white p-4"
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

        <section class="mt-6 rounded-xl border border-line bg-white p-5">
          <h2 class="text-base font-semibold text-ink">條件篩選</h2>
          <p class="mt-1 text-sm text-muted">依來源、產業、名單類型與符合分數過濾名單。</p>

          <div class="mt-4 grid gap-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-sm">
                <span class="text-muted">搜尋</span>
                <div class="relative mt-1">
                  <Search class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" :size="18" />
                  <input
                    v-model="keyword"
                    class="h-10 w-full rounded-lg border border-line bg-white pl-10 pr-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                    placeholder="搜尋公司、類型、Email 或來源"
                  >
                </div>
              </label>

              <label class="block text-sm">
                <span class="text-muted">符合分數下限：<strong class="text-ink">{{ minScore }}</strong></span>
                <input
                  v-model="minScore"
                  class="mt-2 w-full accent-teal"
                  type="range"
                  min="0"
                  max="95"
                >
              </label>
            </div>

            <div class="grid gap-4 sm:grid-cols-3">
              <div ref="filterSourceRef" class="relative text-sm">
                <span class="text-muted">資料來源</span>
                <button
                  type="button"
                  class="mt-1 flex h-10 w-full items-center justify-between rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                  @click.stop="filterSourceOpen = !filterSourceOpen; filterIndustryOpen = false"
                >
                  <span class="truncate" :class="activeSource.length === 0 ? 'text-muted' : 'text-ink'">
                    {{ activeSource.length === 0 ? '全部來源' : activeSource.join('、') }}
                  </span>
                  <ChevronDown :size="15" class="ml-2 shrink-0 text-muted transition-transform" :class="filterSourceOpen ? 'rotate-180' : ''" />
                </button>
                <div
                  v-if="filterSourceOpen"
                  class="absolute z-20 mt-1 w-full min-w-max rounded-lg border border-line bg-white shadow-lg"
                >
                  <label
                    v-for="source in sources"
                    :key="source"
                    class="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-slate-50"
                  >
                    <input type="checkbox" :value="source" v-model="activeSource" class="accent-teal">
                    <span class="text-sm text-ink">{{ source }}</span>
                  </label>
                  <div v-if="activeSource.length > 0" class="border-t border-line px-3 py-2">
                    <button type="button" class="text-xs text-coral hover:underline" @click="activeSource = []">清除選擇</button>
                  </div>
                </div>
              </div>

              <div ref="filterIndustryRef" class="relative text-sm">
                <span class="text-muted">產業</span>
                <button
                  type="button"
                  class="mt-1 flex h-10 w-full items-center justify-between rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                  @click.stop="filterIndustryOpen = !filterIndustryOpen; filterSourceOpen = false"
                >
                  <span class="truncate" :class="activeIndustry.length === 0 ? 'text-muted' : 'text-ink'">
                    {{ activeIndustry.length === 0 ? '全部產業' : activeIndustry.join('、') }}
                  </span>
                  <ChevronDown :size="15" class="ml-2 shrink-0 text-muted transition-transform" :class="filterIndustryOpen ? 'rotate-180' : ''" />
                </button>
                <div
                  v-if="filterIndustryOpen"
                  class="absolute z-20 mt-1 w-full min-w-max rounded-lg border border-line bg-white shadow-lg"
                >
                  <label
                    v-for="industry in industries"
                    :key="industry"
                    class="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-slate-50"
                  >
                    <input type="checkbox" :value="industry" v-model="activeIndustry" class="accent-teal">
                    <span class="text-sm text-ink">{{ industry }}</span>
                  </label>
                  <div v-if="activeIndustry.length > 0" class="border-t border-line px-3 py-2">
                    <button type="button" class="text-xs text-coral hover:underline" @click="activeIndustry = []">清除選擇</button>
                  </div>
                </div>
              </div>

              <label class="block text-sm">
                <span class="text-muted">名單類型</span>
                <input
                  v-model="activeTargetType"
                  class="mt-1 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                  placeholder="輸入類型標籤篩選…"
                >
              </label>
            </div>
          </div>
        </section>

        <section class="mt-4 rounded-xl border border-line bg-white">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[1320px] border-collapse text-left">
              <thead>
                <tr class="border-b border-line bg-slate-50 text-xs font-semibold text-muted">
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">公司</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">來源</th>
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
                  class="h-9 rounded-lg border border-line bg-white px-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
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
                class="grid size-9 place-items-center rounded-lg border border-line bg-white text-muted disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:text-ink"
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
                class="grid size-9 place-items-center rounded-lg border border-line bg-white text-muted disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:text-ink"
                title="下一頁"
                :disabled="currentPage === totalPages"
                @click="goToPage(currentPage + 1)"
              >
                <ChevronRight :size="17" />
              </button>
            </div>
          </div>
        </section>

      </div>

      <div v-else-if="activeView === 'rules'" class="px-4 py-6 sm:px-6 lg:px-8">
        <section class="rounded-xl border border-line bg-white p-5">
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
              class="rounded-xl border border-line p-4"
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
                  class="grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-red-600"
                  title="刪除設定檔"
                  @click="deleteProfile(profile.name)"
                >
                  <Trash2 :size="16" />
                </button>
              </div>

              <div class="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p class="text-xs font-semibold text-muted">公司關鍵字</p>
                  <p class="mt-1 text-ink">{{ profile.companyKeywords.join('、') || '—' }}</p>
                </div>
                <div>
                  <p class="text-xs font-semibold text-muted">業務關鍵字</p>
                  <p class="mt-1 text-ink">{{ profile.businessKeywords.join('、') || '—' }}</p>
                </div>
                <div>
                  <p class="text-xs font-semibold text-muted">排除關鍵字</p>
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

        <section class="mt-6 rounded-xl border border-line bg-white p-5">
          <h2 class="text-base font-semibold text-ink">新增自訂產業設定</h2>
          <p class="mt-1 text-sm text-muted">依你要找的產業，設定關鍵字與門檻分數。關鍵字用逗號或頓號分隔。</p>

          <div class="mt-4 grid gap-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-sm">
                <span class="text-muted">設定名稱</span>
                <input
                  v-model="profileForm.name"
                  class="mt-1 h-10 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                  placeholder="例如：資訊科技、餐飲加盟"
                >
              </label>
              <label class="block text-sm">
                <span class="text-muted">說明</span>
                <input
                  v-model="profileForm.description"
                  class="mt-1 h-10 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                  placeholder="這組設定要找什麼樣的公司"
                >
              </label>
            </div>

            <label class="block text-sm">
              <span class="text-muted">公司關鍵字（出現在公司名稱）</span>
              <textarea
                v-model="profileForm.companyKeywords"
                rows="2"
                class="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                placeholder="資訊、軟體、科技、顧問"
              />
            </label>

            <label class="block text-sm">
              <span class="text-muted">業務關鍵字（出現在類別或名稱中代表符合業務）</span>
              <textarea
                v-model="profileForm.businessKeywords"
                rows="2"
                class="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                placeholder="系統開發、雲端服務、資訊委外"
              />
            </label>

            <label class="block text-sm">
              <span class="text-muted">排除關鍵字（出現時直接扣分）</span>
              <textarea
                v-model="profileForm.excludeKeywords"
                rows="2"
                class="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                placeholder="學校、醫院、政府機關"
              />
            </label>

            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-sm">
                <span class="text-muted">高分標籤（≥ 門檻分數）</span>
                <input
                  v-model="profileForm.proLabel"
                  class="mt-1 h-10 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                >
              </label>
              <label class="block text-sm">
                <span class="text-muted">中分標籤</span>
                <input
                  v-model="profileForm.observableLabel"
                  class="mt-1 h-10 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
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
                class="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
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
        <section class="rounded-xl border border-line bg-white p-5">
          <h2 class="text-base font-semibold text-ink">名單擷取</h2>
          <p class="mt-1 text-sm text-muted">選擇來源、輸入關鍵字，套用一組產業評分規則，系統會在背景擷取並自動評分存入名單。</p>

          <div class="mt-4 grid gap-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="text-sm">
                <span class="text-muted">資料來源（可複選）</span>
                <div class="relative mt-1">
                  <div
                    v-if="sourceDropdownOpen"
                    class="fixed inset-0 z-10"
                    @click="sourceDropdownOpen = false"
                  />
                  <button
                    type="button"
                    class="flex h-10 w-full items-center justify-between rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                    @click="sourceDropdownOpen = !sourceDropdownOpen"
                  >
                    <span :class="scrapeForm.sources.length ? 'text-ink' : 'text-muted'">
                      {{ scrapeForm.sources.length
                        ? dataSources.filter(s => scrapeForm.sources.includes(s.id)).map(s => s.name).join('、')
                        : '請選擇來源' }}
                    </span>
                    <ChevronDown :size="15" class="shrink-0 text-muted" />
                  </button>
                  <div
                    v-if="sourceDropdownOpen"
                    class="absolute z-20 mt-1 w-full rounded-xl border border-line bg-white shadow-lg"
                  >
                    <label class="flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2.5 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        :checked="scrapeForm.sources.length === dataSources.length"
                        :indeterminate="scrapeForm.sources.length > 0 && scrapeForm.sources.length < dataSources.length"
                        class="accent-teal"
                        @change="scrapeForm.sources = scrapeForm.sources.length === dataSources.length ? [] : dataSources.map(s => s.id); scrapeError = ''"
                      />
                      <span class="font-medium text-ink">全選</span>
                    </label>
                    <label
                      v-for="source in dataSources"
                      :key="source.id"
                      class="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        :value="source.id"
                        v-model="scrapeForm.sources"
                        class="accent-teal"
                        @change="scrapeError = ''"
                      />
                      <span class="text-ink">{{ source.name }}</span>
                    </label>
                  </div>
                </div>
              </div>

              <label class="block text-sm">
                <span class="text-muted">產業評分設定</span>
                <select
                  v-model="scrapeForm.profile"
                  class="mt-1 h-10 w-full rounded-lg border border-line px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
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

            <div v-if="selectedSourceHints.length > 0" class="rounded-lg bg-slate-50 border border-line px-4 py-3">
              <p class="text-xs font-medium text-muted mb-2">已選來源的抓取方式</p>
              <ul class="space-y-1.5">
                <li
                  v-for="item in selectedSourceHints"
                  :key="item.name"
                  class="flex gap-2 text-xs text-muted"
                >
                  <span class="shrink-0 font-medium text-ink">{{ item.name }}</span>
                  <span>{{ item.hint }}</span>
                </li>
              </ul>
            </div>

            <label class="block text-sm">
              <span class="text-muted">關鍵字（逗號或頓號分隔，會用來搜尋來源網站）</span>
              <textarea
                v-model="scrapeForm.keywords"
                rows="2"
                class="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
                placeholder="例如：公關、整合行銷、活動企劃"
                @input="scrapeError = ''"
              />
            </label>

            <p v-if="scrapeError" class="text-sm text-red-600">{{ scrapeError }}</p>

            <div>
              <button
                class="inline-flex h-10 items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                :disabled="isRunning"
                @click="startScrape"
              >
                {{ isRunning ? '擷取中…' : '開始擷取' }}
              </button>
            </div>

            <div v-if="activeJobs.length > 0" class="grid gap-2">
              <div
                v-for="job in activeJobs"
                :key="job.id"
                class="rounded-lg border border-line bg-slate-50 p-4 text-sm"
              >
                <div class="flex items-center justify-between">
                  <span class="font-medium text-ink">{{ job.source }}（{{ job.status }}）</span>
                  <span class="text-muted">找到 {{ job.foundCount }} 筆，存入 {{ job.savedCount }} 筆</span>
                </div>
                <p class="mt-1 text-muted">{{ job.errorMessage || job.progressMessage }}</p>
              </div>
            </div>
          </div>
        </section>

        <section class="mt-6 rounded-xl border border-line bg-white">
          <div class="border-b border-line p-4">
            <h2 class="text-base font-semibold text-ink">最近擷取紀錄</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr class="border-b border-line bg-slate-50 text-xs font-semibold text-muted">
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

  <!-- 無法擷取來源清單 Modal -->
  <Teleport to="body">
    <div
      v-if="showBlockedModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      @click.self="showBlockedModal = false"
    >
      <div class="w-full max-w-lg rounded-2xl border border-line bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-line px-6 py-4">
          <div class="flex items-center gap-2">
            <AlertCircle :size="18" class="text-amber-500" />
            <h2 class="text-sm font-semibold text-ink">無法擷取來源清單</h2>
          </div>
          <button class="text-muted hover:text-ink" @click="showBlockedModal = false">
            <X :size="18" />
          </button>
        </div>

        <div class="divide-y divide-line px-6 py-2">
          <div v-for="source in BLOCKED_SOURCES" :key="source.name" class="py-4">
            <div class="flex items-start justify-between gap-3">
              <p class="text-sm font-medium text-ink">{{ source.name }}</p>
              <span class="shrink-0 rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-600">無法抓取</span>
            </div>
            <p class="mt-1 text-xs text-muted leading-relaxed">{{ source.reason }}</p>
          </div>
        </div>

        <div class="border-t border-line px-6 py-3">
          <p class="text-xs text-muted">這些來源需要瀏覽器渲染或 API 授權，目前技術限制無法在背景自動抓取。</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
