// 來源：518熊班人力銀行 (518.com.tw)
// 以關鍵字搜尋職缺，從結果頁抓出公司名稱

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.7',
  Referer: 'https://www.518.com.tw/'
}

const MAX_PAGES = 10
const DELAY_MS = 1500

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function parseCompanies(html) {
  const found = html.matchAll(/[一-鿿\w]{2,20}(?:有限公司|股份有限公司)/g)
  const companies = new Map()
  for (const [name] of found) {
    if (!companies.has(name)) companies.set(name, name)
  }
  return Array.from(companies.keys())
}

async function search(keywords, { onProgress } = {}) {
  const results = []
  const seen = new Set()

  for (const keyword of keywords) {
    onProgress?.(`搜尋 518：「${keyword}」`)

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `https://www.518.com.tw/job-index.html?i_kw=${encodeURIComponent(keyword)}&page=${page}`

      try {
        const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) })

        if (!resp.ok) {
          onProgress?.(`518 HTTP ${resp.status}，略過「${keyword}」`)
          break
        }

        const html = await resp.text()

        if (html.includes('challenges.cloudflare.com')) {
          onProgress?.(`518 被 Cloudflare 保護，略過「${keyword}」`)
          break
        }

        const companies = parseCompanies(html)

        for (const name of companies) {
          if (seen.has(name)) continue
          seen.add(name)
          results.push({
            company: name,
            source: '518',
            category: '518 職缺搜尋',
            fitScore: 60,
            contact: '未公開',
            phone: '未公開',
            website: `https://www.518.com.tw/job-index.html?i_kw=${encodeURIComponent(keyword)}`,
            status: '待開發',
            metadata: { searchKeyword: keyword, eventCount: 1 }
          })
        }

        onProgress?.(`「${keyword}」第 ${page} 頁，找到 ${companies.length} 間`)

        if (companies.length === 0) break
      } catch (err) {
        onProgress?.(`518 搜尋「${keyword}」失敗：${err.message}`)
        break
      }

      if (page < MAX_PAGES) await sleep(DELAY_MS)
    }

    await sleep(DELAY_MS)
  }

  return results
}

export default {
  id: '518',
  name: '518 熊班人力銀行',
  supportsKeywordSearch: true,
  search
}
