import { mkdir, writeFile } from 'node:fs/promises'

const BASE_URL = 'https://salary.tw/industry-type/6001445b81f559e058cb4899'
const TOTAL_PAGES = 63
const DELAY_MS = 2500  // 加長延遲避免 429

// 斷點續抓：從哪頁開始（預設第 1 頁）
const START_PAGE = parseInt(process.argv[2] || '1')

const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.7',
  'Referer': 'https://salary.tw/'
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function decodeHtml(str = '') {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function stripTags(html = '') {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseCompanies(html) {
  const companies = []

  // HTML 結構：<div class="sa_card-item">...</div> 重複
  // 地址：<span class="fz-tit">地址 ｜</span><span>VALUE</span>
  // 電話：<span class="fz-tit">電話 ｜</span><span>VALUE</span>
  // 薪資數：<span>N</span> 則薪水情報
  const blocks = html.split('<div class="sa_card-item">')
  blocks.shift()

  for (const block of blocks) {
    const linkMatch = block.match(/<a href="(https:\/\/salary\.tw\/c\/[^"]+)"[^>]*title="([^"]+)"/)
    if (!linkMatch) continue

    const salaryUrl = linkMatch[1]
    const name = decodeHtml(linkMatch[2])

    // 直接用 span 標籤抓值（結構固定）
    const phoneMatch = block.match(/電話\s*[｜|]<\/span>\s*<span>([^<]+)<\/span>/)
    const rawPhone = phoneMatch ? decodeHtml(phoneMatch[1]).trim() : ''
    const phone = (rawPhone && !['尚未提供','暫不提供'].includes(rawPhone)) ? rawPhone : ''

    const addrMatch = block.match(/地址\s*[｜|]<\/span>\s*<span>([^<]+)<\/span>/)
    const addr = addrMatch ? decodeHtml(addrMatch[1]).trim() : ''

    const countMatch = block.match(/<span>(\d+)<\/span>\s*則薪水情報/)
    const salaryCount = countMatch ? parseInt(countMatch[1]) : 0

    companies.push({ name, salaryUrl, phone, addr, salaryCount })
  }

  return companies
}

async function fetchPage(page) {
  const url = page === 1 ? BASE_URL : `${BASE_URL}?currentPage=${page}`
  const resp = await fetch(url, { headers })

  if (!resp.ok) throw new Error(`HTTP ${resp.status} on page ${page}`)

  return resp.text()
}

function scoreLead({ name, phone, addr }) {
  let score = 50

  // 產業關聯性
  if (/公關|公共關係|PR/.test(name)) score += 25
  if (/整合行銷|整合傳播|IMC/.test(name)) score += 22
  if (/活動|展覽|會展|展演/.test(name)) score += 20
  if (/品牌|廣告|行銷|傳播|媒體/.test(name)) score += 12
  if (/顧問|策略|企劃/.test(name)) score += 8

  // 聯絡資訊完整度
  if (phone && phone !== '暫不提供' && phone !== '尚未提供') score += 15
  if (addr && addr !== '暫不提供') score += 8

  // 知名度 bonus（有薪資情報的公司較大）
  // 已在 salaryCount 欄位，不影響 score

  return Math.min(99, score)
}

// 讀取已有資料（斷點續抓用）
let existingLeads = []
if (START_PAGE > 1) {
  try {
    const { readFile } = await import('node:fs/promises')
    existingLeads = JSON.parse(await readFile('data/leads-salary.json', 'utf8'))
    console.log(`載入已有資料：${existingLeads.length} 間`)
  } catch { /* 沒有舊資料，從頭開始 */ }
}

console.log(`開始抓取 salary.tw 廣告行銷公關業名單，第 ${START_PAGE}-${TOTAL_PAGES} 頁...`)

const allCompanies = []
let successPages = 0
let failedPages = 0

for (let page = START_PAGE; page <= TOTAL_PAGES; page++) {
  try {
    const html = await fetchPage(page)
    const companies = parseCompanies(html)

    if (companies.length === 0) {
      // 嘗試備用 parser（直接從 title 抓）
      const titleMatches = [...html.matchAll(/href="(https:\/\/salary\.tw\/c\/[^"]+)"[^>]*title="([^"]+)"/g)]
      if (titleMatches.length === 0) {
        console.warn(`  ⚠ 第 ${page} 頁解析到 0 間，略過`)
        failedPages++
        continue
      }
    }

    allCompanies.push(...companies)
    process.stdout.write(`\r  已抓 ${page}/${TOTAL_PAGES} 頁，累計 ${allCompanies.length} 間...`)

    if (page < TOTAL_PAGES) await sleep(DELAY_MS)
    successPages++
  } catch (err) {
    console.warn(`\n  ✗ 第 ${page} 頁失敗：${err.message}`)
    failedPages++
    await sleep(DELAY_MS * 2)
  }
}

console.log(`\n\n爬取完成：${successPages} 頁成功，${failedPages} 頁失敗`)

// 合併舊資料（斷點續抓）並去重
const existingNames = new Set(existingLeads.map(l => l.company))
const seen = new Set(existingNames)
const newUnique = allCompanies.filter(c => {
  if (seen.has(c.name)) return false
  seen.add(c.name)
  return true
})
const unique = [...allCompanies.filter(c => !existingNames.has(c.name)).filter((c, i, a) => a.findIndex(x => x.name === c.name) === i)]

console.log(`去重後：${unique.length} 間不重複公司`)

// 轉成 leads 格式並評分（只處理新抓到的）
const leads = unique.map(c => ({
  company: c.name,
  source: 'salary.tw',
  category: '廣告行銷公關業',
  latestEvent: new Date().toISOString().slice(0, 10),
  eventCount: Math.max(1, Math.round(c.salaryCount / 20)), // 用薪資情報數估算活躍度
  fitScore: scoreLead(c),
  contact: '未公開',
  phone: (c.phone && !['暫不提供','尚未提供',''].includes(c.phone)) ? c.phone : '未公開',
  website: c.salaryUrl,
  status: '待開發',
  eventName: '廣告行銷公關業名錄',
  eventUrl: c.salaryUrl,
  professionalScore: scoreLead(c),
  targetType: scoreLead(c) >= 70 ? '專業主辦' : scoreLead(c) >= 50 ? '可觀察' : '一般活動',
  addr: c.addr || ''
}))

// 統計
const hasPhone = leads.filter(l => l.phone !== '未公開').length
const professional = leads.filter(l => l.targetType === '專業主辦').length
const observable = leads.filter(l => l.targetType === '可觀察').length

console.log(`\n統計：`)
console.log(`  有電話：${hasPhone} 間 (${Math.round(hasPhone/leads.length*100)}%)`)
console.log(`  專業主辦：${professional} 間`)
console.log(`  可觀察：${observable} 間`)

// 合併並儲存全部（舊 + 新）
const allLeads = [...existingLeads, ...leads]

await mkdir('data', { recursive: true })
await writeFile('data/leads-salary.json', JSON.stringify(allLeads, null, 2) + '\n')
console.log(`\n✓ 已寫入 data/leads-salary.json（共 ${allLeads.length} 間）`)

// 統計（含舊資料）
const totalWithPhone = allLeads.filter(l => l.phone !== '未公開').length
console.log(`  全部有電話：${totalWithPhone} 間 (${Math.round(totalWithPhone/allLeads.length*100)}%)`)
