// 來源：Yourator 新創求職平台
// 使用公開 JSON API 抓取公司列表，以關鍵字過濾公司名稱或標籤

const BASE_URL = 'https://www.yourator.co/api/v2/companies'
const PER_PAGE = 30
const DELAY_MS = 1000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchPage(page) {
  const url = `${BASE_URL}?page=${page}&per_page=${PER_PAGE}`
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json'
    },
    signal: AbortSignal.timeout(10000)
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json()
}

async function search(keywords, { onProgress } = {}) {
  const keywordList = keywords.map((k) => k.toLowerCase())
  const results = []
  const seen = new Set()

  onProgress?.('Yourator：載入公司列表中…')

  let totalPages = 1
  for (let page = 1; page <= totalPages; page++) {
    try {
      const data = await fetchPage(page)
      totalPages = data.totalPages ?? 1

      onProgress?.(`Yourator 第 ${page}/${totalPages} 頁`)

      for (const company of data.companies ?? []) {
        const brand = company.brand ?? ''
        if (!brand || seen.has(brand)) continue

        // 以關鍵字過濾：比對公司名稱或 tags
        const tagNames = (company.tags ?? []).map((t) => t.name.toLowerCase())
        const matchTarget = [brand.toLowerCase(), ...tagNames].join(' ')
        const matches = keywordList.length === 0 || keywordList.some((k) => matchTarget.includes(k))
        if (!matches) continue

        seen.add(brand)
        const profileUrl = company.enName
          ? `https://www.yourator.co/companies/${company.enName}`
          : 'https://www.yourator.co/companies'

        results.push({
          company: brand,
          source: 'yourator',
          category: company.category?.name ?? 'Yourator 企業',
          fitScore: 60,
          contact: '未公開',
          phone: '未公開',
          website: profileUrl,
          status: '待開發',
          metadata: {
            city: company.city?.name ?? '',
            tags: tagNames.join('、'),
            eventCount: 1
          }
        })
      }
    } catch (err) {
      onProgress?.(`Yourator 第 ${page} 頁失敗：${err.message}`)
      break
    }

    if (page < totalPages) await sleep(DELAY_MS)
  }

  onProgress?.(`Yourator 搜尋完成，共 ${results.length} 間符合`)
  return results
}

export default {
  id: 'yourator',
  name: 'Yourator 新創求職',
  supportsKeywordSearch: true,
  search
}
