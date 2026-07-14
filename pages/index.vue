<script setup lang="ts">
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Mail,
  Phone,
  Search
} from '@lucide/vue'

const { leads, sources, industries, leadsError } = useLeadsData()
const { proLabels, observableLabels, metadataLabel } = useProfiles()

const route = useRoute()
const router = useRouter()

const DEFAULT_MIN_SCORE = 45
const DEFAULT_PAGE_SIZE = 8
const pageSizeOptions = [5, 8, 12, 20]

const toList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === 'string' && value) return value.split(',').filter(Boolean)
  return []
}

const toNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

// 初始狀態直接從網址讀，重新整理或貼網址都能還原
const keyword = ref(String(route.query.q ?? ''))
const activeSource = ref<string[]>(toList(route.query.source))
const activeIndustry = ref<string[]>(toList(route.query.industry))
const activeTargetType = ref(String(route.query.type ?? ''))
const minScore = ref(toNumber(route.query.score, DEFAULT_MIN_SCORE))
const pageSize = ref(toNumber(route.query.size, DEFAULT_PAGE_SIZE))
const currentPage = ref(Math.max(1, toNumber(route.query.page, 1)))

const filterSourceOpen = ref(false)
const filterIndustryOpen = ref(false)
const filterSourceRef = ref<HTMLElement | null>(null)
const filterIndustryRef = ref<HTMLElement | null>(null)

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
      && (lead.professionalScore ?? lead.fitScore) >= Number(minScore.value)
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

const buildQuery = () => {
  const query: Record<string, string> = {}

  if (keyword.value.trim()) query.q = keyword.value.trim()
  if (activeSource.value.length) query.source = activeSource.value.join(',')
  if (activeIndustry.value.length) query.industry = activeIndustry.value.join(',')
  if (activeTargetType.value.trim()) query.type = activeTargetType.value.trim()
  if (Number(minScore.value) !== DEFAULT_MIN_SCORE) query.score = String(minScore.value)
  if (Number(pageSize.value) !== DEFAULT_PAGE_SIZE) query.size = String(pageSize.value)
  if (currentPage.value > 1) query.page = String(currentPage.value)

  return query
}

// 由網址回填狀態時暫停反向同步，避免兩個 watcher 互相觸發
let applyingFromUrl = false
let syncTimer: ReturnType<typeof setTimeout> | undefined

// 篩選條件一變就回到第一頁（頁碼本身改變不算）
watch([keyword, activeSource, activeIndustry, activeTargetType, minScore, pageSize], () => {
  if (applyingFromUrl) return
  currentPage.value = 1
}, { deep: true })

// 狀態 → 網址。debounce 避免打字與拖曳滑桿時塞爆瀏覽器歷史紀錄
watch([keyword, activeSource, activeIndustry, activeTargetType, minScore, pageSize, currentPage], () => {
  if (applyingFromUrl) return

  clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    const query = buildQuery()

    if (JSON.stringify(query) === JSON.stringify(route.query)) return

    router.push({ query })
  }, 300)
}, { deep: true })

// 網址 → 狀態，讓瀏覽器上一頁/下一頁能正常運作
watch(() => route.query, (query) => {
  applyingFromUrl = true

  keyword.value = String(query.q ?? '')
  activeSource.value = toList(query.source)
  activeIndustry.value = toList(query.industry)
  activeTargetType.value = String(query.type ?? '')
  minScore.value = toNumber(query.score, DEFAULT_MIN_SCORE)
  pageSize.value = toNumber(query.size, DEFAULT_PAGE_SIZE)
  currentPage.value = Math.max(1, toNumber(query.page, 1))

  nextTick(() => {
    applyingFromUrl = false
  })
})

const summary = computed(() => {
  const professionalLeads = leads.value.filter((lead) => lead.targetType && proLabels.value.has(lead.targetType)).length
  const observableLeads = leads.value.filter((lead) => lead.targetType && observableLabels.value.has(lead.targetType)).length
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recentCount = leads.value.filter((lead) => lead.createdAt && new Date(lead.createdAt).getTime() >= sevenDaysAgo).length

  return [
    { label: '名單總數', value: leads.value.length.toLocaleString(), hint: 'Neon 雲端資料' },
    { label: '高潛力名單', value: professionalLeads.toLocaleString(), hint: '優先開發' },
    { label: '可觀察名單', value: observableLeads.toLocaleString(), hint: '需人工確認' },
    { label: '產業設定', value: industries.value.length.toLocaleString(), hint: '評分規則分組' },
    { label: '近 7 天新增', value: recentCount.toLocaleString(), hint: '所有產業合計' }
  ]
})

const targetTypeClass = (targetType?: string) => {
  if (targetType && proLabels.value.has(targetType)) return 'bg-teal-50 text-teal-700 ring-teal-200'
  return 'bg-amber-50 text-amber-700 ring-amber-200'
}

function handleClickOutside(e: MouseEvent) {
  if (filterSourceRef.value && !filterSourceRef.value.contains(e.target as Node)) {
    filterSourceOpen.value = false
  }
  if (filterIndustryRef.value && !filterIndustryRef.value.contains(e.target as Node)) {
    filterIndustryOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  clearTimeout(syncTimer)
})
</script>

<template>
  <div class="px-4 py-6 sm:px-6 lg:px-8">
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
                <input v-model="activeSource" type="checkbox" :value="source" class="accent-teal">
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
                <input v-model="activeIndustry" type="checkbox" :value="industry" class="accent-teal">
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
</template>
