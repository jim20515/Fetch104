// 來源：company.g0v.ronny.tw（整合自政府 GCIS 工商登記資料）
// 以關鍵字搜尋全國公司名稱，回傳符合的有限/股份公司

const BASE_URL = 'https://company.g0v.ronny.tw/api/search'
const PER_PAGE = 10    // g0v 固定每頁 10 筆
const MAX_PAGES = 20   // 每個關鍵字最多抓 20 頁（200 筆）
const DELAY_MS = 1500

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// g0v 的公司資料結構：公司名稱 + 公司狀況
// 只保留「核准設立」的現存公司
function isActiveCompany(row) {
  // 有 '公司名稱' 欄位 = 工商登記的公司（非協會）
  if (!row['公司名稱']) return false
  const status = row['公司狀況'] ?? ''
  return status.includes('核准設立')
}

async function fetchPage(keyword, page) {
  const url = `${BASE_URL}?q=${encodeURIComponent(keyword)}&page=${page}`
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(10000)
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json()
}

async function search(keywords, { onProgress } = {}) {
  const results = []
  const seen = new Set()

  for (const keyword of keywords) {
    // g0v 混合公司與協會資料，加上「有限公司」才能找到公司登記資料
    const query = keyword.includes('公司') ? keyword : `${keyword}有限公司`
    onProgress?.(`GCIS 搜尋：「${keyword}」`)
    let totalFound = 0

    for (let page = 0; page < MAX_PAGES; page++) {
      try {
        const data = await fetchPage(query, page)
        const rows = data.data ?? []

        if (rows.length === 0) break

        for (const row of rows) {
          if (!isActiveCompany(row)) continue
          const name = row['公司名稱']
          if (seen.has(name)) continue
          seen.add(name)
          totalFound++

          const addr = row['公司所在地'] ?? ''
          const tin = row['統一編號'] ?? ''
          const phone = row['電話'] ?? ''
          const website = tin ? `https://company.g0v.ronny.tw/id/${tin}` : ''

          const rep = row['代表人姓名'] ?? ''
          results.push({
            company: name,
            source: 'gcis',
            category: '工商登記',
            fitScore: 50,
            contact: rep || '未公開',
            phone: phone || '未公開',
            website,
            status: '待開發',
            metadata: { tin, addr, searchKeyword: keyword, eventCount: 1 }
          })
        }

        if (rows.length < PER_PAGE) break
      } catch (err) {
        onProgress?.(`GCIS 第 ${page + 1} 頁失敗：${err.message}`)
        break
      }

      if (page < MAX_PAGES - 1) await sleep(DELAY_MS)
    }

    onProgress?.(`「${keyword}」找到 ${totalFound} 間公司`)
    await sleep(DELAY_MS)
  }

  return results
}

export default {
  id: 'gcis',
  name: 'GCIS 工商登記',
  supportsKeywordSearch: true,
  search
}
