/**
 * 從官方網站補全聯絡資訊
 * 流程：DDG 搜尋官網 URL → 抓官網 HTML → 提取電話/信箱
 * 只處理 target_type IN ('專業主辦','可觀察') 的 salary.tw 名單
 *
 * 使用方式：
 *   node scripts/enrich-contacts.mjs          # 從頭開始
 *   node scripts/enrich-contacts.mjs 100      # 從第 100 筆開始（斷點續跑）
 */
import { spawnSync } from 'node:child_process'

const dbPath = 'data/leads.sqlite'
const DDG_DELAY = 3000   // DDG 搜尋間隔（ms）
const SITE_DELAY = 1500  // 官網抓取間隔（ms）
const SKIP = parseInt(process.argv[2] || '0')

const escapeSql = (v) => String(v ?? '').replaceAll("'", "''")

function runSql(sql) {
  const r = spawnSync('sqlite3', ['-json', dbPath, sql], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr)
  return JSON.parse(r.stdout || '[]')
}
function execSql(sql) {
  const r = spawnSync('sqlite3', [dbPath], { input: sql, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr)
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.7',
}

// 台灣電話格式：必須有分隔符號，避免抓到 CSS 數值或訂單號
// 市話：0X-XXXX-XXXX 或 0XX-XXX-XXXX；手機：09XX-XXX-XXX
const PHONE_RE = /(?:0[2-9]\d{0,2})[-\s](?:\d{3,4})[-\s](\d{4})(?!\d)/g
const EMAIL_RE = /[\w.+\-]{2,}@[\w\-]{2,}\.(?:com|net|org|tw|io)(?:\.tw)?/gi

// 排除 DDG 自己的域名和常見非目標域名
const SKIP_DOMAINS = new Set([
  // 搜尋引擎 / 社群
  'duckduckgo.com', 'google.com', 'facebook.com', 'instagram.com',
  'linkedin.com', 'twitter.com', 'youtube.com', 'wikipedia.org',
  // 求職平台
  '104.com.tw', '1111.com.tw', 'cakeresume.com', 'salary.tw',
  'indeed.com', 'yourator.co', 'interview.tw',
  // 活動平台
  'accupass.com', 'kktix.com', 'beclass.com',
  // 公司查詢目錄（非官網）
  'findcompany.com.tw', 'tycoon.com.tw', 'fasterdata.com.tw',
  'yellow-pages.com.tw', 'go2.com.tw', 'gcis.nat.gov.tw',
  'company.g0v.ronny.tw', 'twincn.com', 'whos.com.tw',
  'findglocal.com', 'bizrating.com.tw', 'taiwantrade.com',
  // 電商/入口
  'pchome.com.tw', '591.com.tw', 'yahoo.com', 'line.me',
])

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch { return '' }
}

// 用 DuckDuckGo HTML 搜尋找官網
async function searchOfficialWebsite(companyName) {
  const query = encodeURIComponent(`${companyName} 官網`)
  const url = `https://html.duckduckgo.com/html/?q=${query}`
  try {
    const resp = await fetch(url, { headers: HEADERS })
    const html = await resp.text()
    // 解析 uddg 重新導向 URL（DDG 結果的真實 URL）
    const uddgs = [...html.matchAll(/uddg=(https?%3A%2F%2F[^&"]+)/g)]
      .map(m => decodeURIComponent(m[1]))
      .filter(u => {
        const domain = extractDomain(u)
        return domain && !SKIP_DOMAINS.has(domain) && !SKIP_DOMAINS.has(domain.split('.').slice(-2).join('.'))
      })
    return uddgs[0] ?? null
  } catch (e) {
    return null
  }
}

// 抓官網 HTML 並提取電話/信箱
async function scrapeContact(siteUrl) {
  const result = { phone: null, email: null }
  if (!siteUrl) return result

  try {
    // 先試 /contact、/about 頁面，再試首頁
    const candidates = [siteUrl]
    const base = siteUrl.replace(/\/$/, '')
    candidates.push(`${base}/contact`, `${base}/contact-us`, `${base}/about`)

    for (const url of candidates) {
      try {
        const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) })
        if (!resp.ok) continue
        const contentType = resp.headers.get('content-type') || ''
        if (!contentType.includes('html')) continue
        const html = await resp.text()

        // 提取電話（優先台灣市話格式）
        if (!result.phone) {
          const phones = [...html.matchAll(PHONE_RE)].map(m => m[0].trim()).filter(p => p.length >= 8)
          if (phones.length) {
            // 優先選有區碼的市話（0x-xxxx-xxxx 格式）
            const landline = phones.find(p => /^0[2-9]/.test(p))
            result.phone = landline ?? phones[0]
          }
        }

        // 提取信箱（排除 noreply、example、sentry 等）
        if (!result.email) {
          const emails = [...html.matchAll(EMAIL_RE)].map(m => m[0].toLowerCase())
          const real = emails.find(e => !/noreply|no-reply|example|sentry|webmaster|admin@/.test(e))
          if (real) result.email = real
        }

        if (result.phone && result.email) break
        await sleep(SITE_DELAY)
      } catch { /* 單頁失敗繼續 */ }
    }
  } catch { /* 整體失敗 */ }

  return result
}

// ── 主流程 ─────────────────────────────────────────────────────────────
const leads = runSql(`
  SELECT id, company, phone, contact, official_website
  FROM leads
  WHERE source = 'salary.tw'
  AND target_type IN ('專業主辦', '可觀察')
  ORDER BY professional_score DESC, id ASC
`)

console.log(`共 ${leads.length} 間需要補充，從第 ${SKIP + 1} 筆開始...\n`)

let enriched = 0, skipped = 0, failed = 0

for (let i = SKIP; i < leads.length; i++) {
  const lead = leads[i]
  const needWebsite = !lead.official_website
  const needPhone = lead.phone === '未公開'
  const needEmail = lead.contact === '未公開'

  if (!needWebsite && !needPhone && !needEmail) {
    skipped++
    continue
  }

  process.stdout.write(`\r[${i + 1}/${leads.length}] ${lead.company.slice(0, 20).padEnd(20)}`)

  let officialWebsite = lead.official_website
  let phone = lead.phone
  let email = lead.contact

  // 1. 找官網
  if (needWebsite) {
    officialWebsite = await searchOfficialWebsite(lead.company)
    await sleep(DDG_DELAY)
  }

  // 2. 從官網抓聯絡資訊
  if (officialWebsite && (needPhone || needEmail)) {
    const contact = await scrapeContact(officialWebsite)
    if (needPhone && contact.phone) phone = contact.phone
    if (needEmail && contact.email) email = contact.email
    await sleep(SITE_DELAY)
  }

  // 3. 更新 DB
  const sets = [`official_website = '${escapeSql(officialWebsite ?? '')}'`, `updated_at = CURRENT_TIMESTAMP`]
  if (needPhone && phone !== '未公開') sets.push(`phone = '${escapeSql(phone)}'`)
  if (needEmail && email !== '未公開') sets.push(`contact = '${escapeSql(email)}'`)

  execSql(`UPDATE leads SET ${sets.join(', ')} WHERE id = ${lead.id};`)
  enriched++

  // 每 10 筆顯示一次進度摘要
  if ((i + 1) % 10 === 0) {
    const sample = runSql(`
      SELECT company, official_website, phone, contact FROM leads
      WHERE source='salary.tw' AND official_website IS NOT NULL AND official_website != ''
      ORDER BY updated_at DESC LIMIT 3
    `)
    console.log(`\n  [範例]`)
    sample.forEach(s => console.log(`  ${s.company} → ${s.official_website} | ${s.phone} | ${s.contact}`))
    console.log()
  }
}

console.log(`\n\n✓ 完成`)
console.log(`  處理：${enriched} 間`)
console.log(`  略過（已有資料）：${skipped} 間`)

// 最終統計
const stats = runSql(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN official_website IS NOT NULL AND official_website != '' THEN 1 ELSE 0 END) as has_website,
    SUM(CASE WHEN phone != '未公開' THEN 1 ELSE 0 END) as has_phone,
    SUM(CASE WHEN contact != '未公開' THEN 1 ELSE 0 END) as has_email
  FROM leads
  WHERE source='salary.tw' AND target_type IN ('專業主辦','可觀察')
`)[0]

console.log(`\n=== salary.tw 專業主辦/可觀察 ===`)
console.log(`  官網：${stats.has_website}/${stats.total}`)
console.log(`  電話：${stats.has_phone}/${stats.total}`)
console.log(`  信箱：${stats.has_email}/${stats.total}`)
