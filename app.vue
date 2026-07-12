<script setup lang="ts">
import {
  AlertCircle,
  Building2,
  Database,
  Download,
  Radar,
  RefreshCw,
  SlidersHorizontal,
  Target,
  Upload,
  X
} from '@lucide/vue'

const { leadsPending, refreshLeads } = useLeadsData()

const navItems = [
  { to: '/', label: '名單探索', icon: Target },
  { to: '/sources', label: '資料來源', icon: Database },
  { to: '/rules', label: '評分規則', icon: SlidersHorizontal }
]

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
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted hover:bg-slate-50"
          active-class="bg-slate-100 text-ink"
        >
          <component :is="item.icon" :size="17" />
          {{ item.label }}
        </NuxtLink>
        <button class="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted hover:bg-slate-50">
          <Building2 :size="17" />
          公司資料
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

      <NuxtPage />
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
            <p class="mt-1 text-xs leading-relaxed text-muted">{{ source.reason }}</p>
          </div>
        </div>

        <div class="border-t border-line px-6 py-3">
          <p class="text-xs text-muted">這些來源需要瀏覽器渲染或 API 授權，目前技術限制無法在背景自動抓取。</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
