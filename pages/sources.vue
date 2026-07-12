<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import type { ScrapeJob } from '~/types/leads'

const { dataSources, recentJobs, refreshJobs } = useScrapeData()
const { profiles } = useProfiles()
const { refreshLeads } = useLeadsData()

const scrapeForm = ref({ sources: [] as string[], keywords: '', profile: '' })
const sourceDropdownOpen = ref(false)

const SOURCE_KEYWORD_HINTS: Record<string, string> = {
  'salary.tw': '抓取固定的「廣告行銷公關業」頁面，關鍵字用來過濾公司名稱，名字含關鍵字的才留下',
  '104': '以關鍵字搜尋 104 職缺，從結果頁抓出刊登職缺的公司名稱',
  'gcis': '以關鍵字搜尋全國工商登記，每個關鍵字是一次獨立查詢，找名稱含該詞的公司',
  'yourator': '抓取 Yourator 上所有公司，以關鍵字過濾公司名稱或標籤（如整合行銷、公關顧問）',
  '518': '以關鍵字搜尋 518 熊班人力銀行職缺，從結果頁抓出刊登職缺的公司名稱'
}

const selectedSourceHints = computed(() =>
  scrapeForm.value.sources
    .map((id) => {
      const src = dataSources.value.find((s) => s.id === id)
      const hint = SOURCE_KEYWORD_HINTS[id]
      return src && hint ? { name: src.name, hint } : null
    })
    .filter(Boolean) as { name: string, hint: string }[]
)

const scrapeError = ref('')
const activeJobs = ref<ScrapeJob[]>([])
const pollTimers = new Map<number, ReturnType<typeof setTimeout>>()

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
</script>

<template>
  <div class="px-4 py-6 sm:px-6 lg:px-8">
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
                  >
                  <span class="font-medium text-ink">全選</span>
                </label>
                <label
                  v-for="source in dataSources"
                  :key="source.id"
                  class="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50"
                >
                  <input
                    v-model="scrapeForm.sources"
                    type="checkbox"
                    :value="source.id"
                    class="accent-teal"
                    @change="scrapeError = ''"
                  >
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

        <div v-if="selectedSourceHints.length > 0" class="rounded-lg border border-line bg-slate-50 px-4 py-3">
          <p class="mb-2 text-xs font-medium text-muted">已選來源的抓取方式</p>
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
</template>
