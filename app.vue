<script setup lang="ts">
import {
  Building2,
  CalendarDays,
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
  Upload
} from '@lucide/vue'

type LeadSource = string

interface Lead {
  id?: number
  company: string
  source: LeadSource
  category: string
  latestEvent: string
  eventCount: number
  fitScore: number
  contact: string
  phone: string
  website: string
  status: '待開發' | '已聯絡' | '高意願'
  eventName?: string
  eventUrl?: string
  professionalScore?: number
  targetType?: '專業主辦' | '可觀察' | '一般活動'
  scoreReason?: string | null
  officialWebsite?: string | null
  createdAt?: string
  updatedAt?: string
}

const { data: leadResponse, pending: leadsPending, error: leadsError, refresh: refreshLeads } = await useFetch<{
  leads: Lead[]
  total: number
  sources: LeadSource[]
  storage: string
}>('/api/leads', {
  default: () => ({
    leads: [],
    total: 0,
    sources: [],
    storage: 'sqlite'
  })
})

const leads = computed(() => leadResponse.value?.leads ?? [])
const sources = computed<LeadSource[]>(() => leadResponse.value?.sources ?? [])

const keyword = ref('')
const activeSource = ref<LeadSource | '全部'>('全部')
const activeTargetType = ref<'專業主辦' | '可觀察' | '全部'>('全部')
const minScore = ref(45)
const currentPage = ref(1)
const pageSize = ref(8)
const pageSizeOptions = [5, 8, 12, 20]
const targetTypeOptions = ['全部', '專業主辦', '可觀察'] as const

const filteredLeads = computed(() => {
  const term = keyword.value.trim().toLowerCase()

  return leads.value.filter((lead) => {
    const matchesKeyword = !term || [
      lead.company,
      lead.category,
      lead.contact,
      lead.source,
      lead.eventName ?? ''
    ].some((value) => value.toLowerCase().includes(term))

    return matchesKeyword
      && (activeSource.value === '全部' || lead.source === activeSource.value)
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

watch([keyword, activeSource, activeTargetType, minScore, pageSize], () => {
  currentPage.value = 1
})

const summary = computed(() => {
  const professionalLeads = leads.value.filter((lead) => lead.targetType === '專業主辦').length
  const observableLeads = leads.value.filter((lead) => lead.targetType === '可觀察').length
  const averageEvents = leads.value.length
    ? leads.value.reduce((total, lead) => total + lead.eventCount, 0) / leads.value.length
    : 0

  return [
    { label: '名單總數', value: leads.value.length.toLocaleString(), hint: 'SQLite 本機資料' },
    { label: '專業主辦', value: professionalLeads.toLocaleString(), hint: '優先開發' },
    { label: '可觀察', value: observableLeads.toLocaleString(), hint: '需人工確認' },
    { label: '資料來源', value: sources.value.length.toLocaleString(), hint: '平台與名錄' },
    { label: '平均活動數', value: averageEvents.toFixed(1), hint: '同主辦累計' }
  ]
})

const statusClass = (status: Lead['status']) => {
  return {
    '高意願': 'bg-teal-50 text-teal-700 ring-teal-200',
    '已聯絡': 'bg-amber-50 text-amber-700 ring-amber-200',
    '待開發': 'bg-slate-100 text-slate-700 ring-slate-200'
  }[status]
}
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
        <button class="flex h-10 w-full items-center gap-3 rounded-md bg-slate-100 px-3 text-sm font-medium text-ink">
          <Target :size="17" />
          名單探索
        </button>
        <button class="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted hover:bg-slate-50">
          <CalendarDays :size="17" />
          活動來源
        </button>
        <button class="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted hover:bg-slate-50">
          <Building2 :size="17" />
          公司資料
        </button>
        <button class="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted hover:bg-slate-50">
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

      <div class="px-4 py-6 sm:px-6 lg:px-8">
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
          <div class="grid gap-3 border-b border-line p-4 xl:grid-cols-[1fr_auto_auto_auto]">
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
              <span>主辦分數</span>
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
            <table class="w-full min-w-[1180px] border-collapse text-left">
              <thead>
                <tr class="border-b border-line bg-slate-50 text-xs uppercase text-muted">
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">公司</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">來源</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">類型</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">最近活動</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">活動數</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">主辦分數</th>
                  <th class="whitespace-nowrap px-4 py-3 font-semibold">聯絡資訊</th>
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
                  <td class="whitespace-nowrap px-4 py-4 text-sm text-muted">{{ lead.latestEvent }}</td>
                  <td class="whitespace-nowrap px-4 py-4 text-sm font-medium text-ink">{{ lead.eventCount }}</td>
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
                  <td class="px-4 py-4">
                    <span class="inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1" :class="lead.targetType === '專業主辦' ? 'bg-teal-50 text-teal-700 ring-teal-200' : 'bg-amber-50 text-amber-700 ring-amber-200'">
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
                <p class="text-sm text-muted"><strong class="text-ink">活動平台主辦單位</strong>：ACCUPASS、KKTIX、BeClass，需求最直接。</p>
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
              <span class="rounded-md bg-slate-100 px-3 py-2 text-muted">event_url</span>
              <span class="rounded-md bg-slate-100 px-3 py-2 text-muted">website</span>
              <span class="rounded-md bg-slate-100 px-3 py-2 text-muted">email</span>
              <span class="rounded-md bg-slate-100 px-3 py-2 text-muted">phone</span>
              <span class="rounded-md bg-slate-100 px-3 py-2 text-muted">fit_score</span>
              <span class="rounded-md bg-slate-100 px-3 py-2 text-muted">last_event_at</span>
            </div>
          </div>
        </section>
      </div>
    </section>
  </main>
</template>
