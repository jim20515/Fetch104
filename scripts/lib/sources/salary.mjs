const INDUSTRY_URL = 'https://salary.tw/industry-type/6001445b81f559e058cb4899'
const MAX_PAGES = 10   // 最多抓 10 頁（200 間），快速搜尋用
const DELAY_MS = 2000

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.7',
  Referer: 'https://salary.tw/'
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const decodeHtml = (s = '') => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim()

function parsePage(html) {
  const companies = []
  const blocks = html.split('<div class="sa_card-item">')
  blocks.shift()

  for (const block of blocks) {
    const linkMatch = block.match(/<a href="(https:\/\/salary\.tw\/c\/[^"]+)"[^>]*title="([^"]+)"/)
    if (!linkMatch) continue

    const salaryUrl = linkMatch[1]
    const name = decodeHtml(linkMatch[2])
    const phoneMatch = block.match(/電話\s*[｜|]<\/span>\s*<span>([^<]+)<\/span>/)
    const rawPhone = phoneMatch ? decodeHtml(phoneMatch[1]).trim() : ''
    const phone = rawPhone && !['尚未提供', '暫不提供'].includes(rawPhone) ? rawPhone : ''
    const addrMatch = block.match(/地址\s*[｜|]<\/span>\s*<span>([^<]+)<\/span>/)
    const addr = addrMatch ? decodeHtml(addrMatch[1]).trim() : ''
    const countMatch = block.match(/<span>(\d+)<\/span>\s*則薪水情報/)
    const salaryCount = countMatch ? parseInt(countMatch[1]) : 0

    companies.push({ name, salaryUrl, phone, addr, salaryCount })
  }

  return companies
}

async function search(keywords, { onProgress } = {}) {
  const keywordList = keywords.map((k) => k.toLowerCase())
  const results = []
  const seen = new Set()

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? INDUSTRY_URL : `${INDUSTRY_URL}?currentPage=${page}`
    onProgress?.(`salary.tw 第 ${page}/${MAX_PAGES} 頁`)

    try {
      const resp = await fetch(url, { headers: HEADERS })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const html = await resp.text()
      const companies = parsePage(html)
      if (companies.length === 0) break

      for (const c of companies) {
        if (seen.has(c.name)) continue
        // 過濾：公司名稱含任一關鍵字，或關鍵字為空（回傳全部）
        const matches = keywordList.length === 0 || keywordList.some((k) => c.name.toLowerCase().includes(k))
        if (!matches) continue
        seen.add(c.name)

        results.push({
          company: c.name,
          source: 'salary.tw',
          category: '廣告行銷公關業',
          fitScore: 55,
          contact: '未公開',
          phone: c.phone || '未公開',
          website: c.salaryUrl,
          status: '待開發',
          metadata: {
            addr: c.addr,
            salaryCount: c.salaryCount,
            eventCount: Math.max(1, Math.round(c.salaryCount / 20))
          }
        })
      }
    } catch (err) {
      onProgress?.(`salary.tw 第 ${page} 頁失敗：${err.message}`)
    }

    if (page < MAX_PAGES) await sleep(DELAY_MS)
  }

  onProgress?.(`salary.tw 搜尋完成，共 ${results.length} 間符合`)
  return results
}

export default {
  id: 'salary.tw',
  name: 'salary.tw 薪資資料庫',
  supportsKeywordSearch: true,
  search
}
