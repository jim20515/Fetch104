// 來源：中華黃頁 (iyp.com.tw)
// 以關鍵字搜尋商家名錄
// 注意：部分請求可能因 anti-bot 保護失敗

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.7',
  Referer: 'https://www.iyp.com.tw/'
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function parseCompanies(html) {
  const companies = []
  const seen = new Set()

  const patterns = [
    /<h2[^>]*class="[^"]*company[^"]*"[^>]*>\s*<a[^>]*>([^<]{2,50})<\/a>/g,
    /class="[^"]*biz-name[^"]*"[^>]*>\s*([^<]{2,50})\s*</g,
    /<a[^>]+href="\/biz\/[^"]*"[^>]*>([^<]{2,50})<\/a>/g,
    /itemprop="name"[^>]*>\s*([^<]{2,50})\s*</g
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(html))) {
      const name = match[1].trim()
      if (name && !seen.has(name) && name.length >= 2) {
        seen.add(name)
        companies.push(name)
      }
    }
  }

  return companies
}

async function search(keywords, { onProgress } = {}) {
  const results = []
  const seen = new Set()

  for (const keyword of keywords) {
    const url = `https://www.iyp.com.tw/search?q=${encodeURIComponent(keyword)}&page=1`
    onProgress?.(`搜尋台灣黃頁：「${keyword}」`)

    try {
      const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) })

      if (!resp.ok) {
        onProgress?.(`台灣黃頁 HTTP ${resp.status}，「${keyword}」略過`)
        continue
      }

      const html = await resp.text()

      if (html.length < 500) {
        onProgress?.(`台灣黃頁回傳空白頁，「${keyword}」略過`)
        continue
      }

      const companies = parseCompanies(html)

      for (const name of companies) {
        if (seen.has(name)) continue
        seen.add(name)
        results.push({
          company: name,
          source: 'yellow-pages',
          category: '黃頁商家',
          fitScore: 50,
          contact: '未公開',
          phone: '未公開',
          website: `https://www.iyp.com.tw/search?q=${encodeURIComponent(keyword)}`,
          status: '待開發',
          metadata: { searchKeyword: keyword, eventCount: 1 }
        })
      }

      if (companies.length > 0) {
        onProgress?.(`「${keyword}」找到 ${companies.length} 間商家`)
      } else {
        onProgress?.(`「${keyword}」未找到商家（可能需要登入或頁面結構不同）`)
      }
    } catch (err) {
      onProgress?.(`台灣黃頁搜尋「${keyword}」失敗：${err.message}`)
    }

    await sleep(2000)
  }

  return results
}

export default {
  id: 'yellow-pages',
  name: '台灣黃頁',
  supportsKeywordSearch: true,
  search
}
