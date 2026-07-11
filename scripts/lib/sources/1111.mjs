// 來源：1111 人力銀行
// 從職缺搜尋頁抓公司名稱
// 注意：1111 有 Cloudflare 保護，若被擋會顯示明確錯誤訊息

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.7',
  Referer: 'https://www.1111.com.tw/'
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function parseCompanies(html) {
  const companies = new Map()
  const patterns = [
    /<a[^>]+class="[^"]*company[^"]*"[^>]*>([^<]{2,40})<\/a>/g,
    /class="[^"]*corp[^"]*"[^>]*>\s*([^<]{2,40})\s*</g,
    /"company_name":"([^"]{2,40})"/g,
    /data-company="([^"]{2,40})"/g
  ]
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(html))) {
      const name = match[1].trim()
      if (name && !companies.has(name) && !/^\d+$/.test(name)) {
        companies.set(name, name)
      }
    }
  }
  return Array.from(companies.keys())
}

async function search(keywords, { onProgress } = {}) {
  const results = []
  const seen = new Set()

  for (const keyword of keywords) {
    const url = `https://www.1111.com.tw/search/job?ks=${encodeURIComponent(keyword)}&page=1`
    onProgress?.(`搜尋 1111：「${keyword}」`)

    try {
      const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) })

      if (!resp.ok) {
        onProgress?.(`1111 回傳 HTTP ${resp.status}（可能被 Cloudflare 擋住），略過「${keyword}」`)
        continue
      }

      const html = await resp.text()

      if (html.includes('challenges.cloudflare.com')) {
        onProgress?.(`1111 被 Cloudflare 保護，無法直接抓取「${keyword}」`)
        continue
      }

      if (html.includes('<title>Loading...</title>') || html.length < 1000) {
        onProgress?.(`1111 以 JavaScript 渲染，伺服器端無法解析，「${keyword}」略過`)
        continue
      }

      const companies = parseCompanies(html)
      for (const name of companies) {
        if (seen.has(name)) continue
        seen.add(name)
        results.push({
          company: name,
          source: '1111',
          category: '1111 職缺搜尋',
          fitScore: 60,
          contact: '未公開',
          phone: '未公開',
          website: `https://www.1111.com.tw/search/job?ks=${encodeURIComponent(keyword)}`,
          status: '待開發',
          metadata: { searchKeyword: keyword, eventCount: 1 }
        })
      }

      onProgress?.(`「${keyword}」找到 ${companies.length} 間公司`)
    } catch (err) {
      onProgress?.(`1111 搜尋「${keyword}」失敗：${err.message}`)
    }

    await sleep(2000)
  }

  return results
}

export default {
  id: '1111',
  name: '1111 人力銀行',
  supportsKeywordSearch: true,
  search
}
