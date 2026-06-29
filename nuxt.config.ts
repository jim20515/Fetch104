export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: '活動名單雷達',
      meta: [
        {
          name: 'description',
          content: '活動報名報到系統的潛在客戶名單管理前台'
        }
      ]
    }
  }
})
