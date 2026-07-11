// 來源：104 人力銀行
// 使用公開 JSON API 搜尋職缺，從結果抓出刊登職缺的公司名稱（比 HTML 解析穩定）

const API_BASE = 'https://www.104.com.tw/jobs/search/list'
const MAX_PAGES = 10
const ROWS_PER_PAGE = 30
const DELAY_MS = 1500

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.7',
  Referer: 'https://www.104.com.tw/jobs/search/',
  'X-Requested-With': 'XMLHttpRequest'
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchPage(keyword, page) {
  const url = `${API_BASE}?keyword=${encodeURIComponent(keyword)}&order=14&asc=0&sr=99&page=${page}&rows=${ROWS_PER_PAGE}`
  const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) })
  if (resp.status === 403 || resp.status === 429) throw new Error(`Cloudflare 封鎖（HTTP ${resp.status}）`)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json()
}

async function search(keywords, { onProgress } = {}) {
  const results = []
  const seen = new Set()

  for (const keyword of keywords) {
    onProgress?.(`搜尋 104：「${keyword}」`)
    let totalPages = 1

    for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page++) {
      try {
        const json = await fetchPage(keyword, page)
        const list = json?.data?.list ?? []
        totalPages = json?.data?.totalPage ?? 1

        onProgress?.(`104「${keyword}」第 ${page}/${Math.min(totalPages, MAX_PAGES)} 頁，共 ${totalPages} 頁`)

        if (list.length === 0) break

        for (const job of list) {
          const name = (job.custName ?? '').trim()
          if (!name || seen.has(name)) continue
          seen.add(name)

          const cusPath = job.link?.cus ?? ''
          const website = cusPath
            ? `https://www.104.com.tw${cusPath}`
            : `https://www.104.com.tw/jobs/search/?keyword=${encodeURIComponent(keyword)}`

          results.push({
            company: name,
            source: '104',
            category: '104 職缺搜尋',
            fitScore: 60,
            contact: '未公開',
            phone: '未公開',
            website,
            status: '待開發',
            metadata: { searchKeyword: keyword, eventCount: 1 }
          })
        }
      } catch (err) {
        onProgress?.(`104 搜尋「${keyword}」第 ${page} 頁失敗：${err.message}`)
        break
      }

      if (page < Math.min(totalPages, MAX_PAGES)) await sleep(DELAY_MS)
    }

    await sleep(DELAY_MS)
  }

  onProgress?.(`104 搜尋完成，共 ${results.length} 間`)
  return results
}

export default {
  id: '104',
  name: '104 人力銀行',
  supportsKeywordSearch: true,
  search
}
