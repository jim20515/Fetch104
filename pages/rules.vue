<script setup lang="ts">
import { Trash2 } from '@lucide/vue'

const { profiles, refreshProfiles } = useProfiles()

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
</script>

<template>
  <div class="px-4 py-6 sm:px-6 lg:px-8">
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
</template>
