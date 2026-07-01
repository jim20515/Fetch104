import { mkdir, writeFile } from 'node:fs/promises'
import { loadProfile, scoreWithProfile } from './lib/scoring-profiles.mjs'

const dbPath = 'data/leads.sqlite'
const profileArg = process.argv.find((arg) => arg.startsWith('--profile='))
const profileName = profileArg ? profileArg.slice('--profile='.length) : '活動會展'
const profile = loadProfile(dbPath, profileName)

const headers = {
  'User-Agent': 'Mozilla/5.0 (compatible; LeadFinder/1.0; +https://localhost)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.7'
}

const accupassSearchUrls = [
  'https://www.accupass.com/search?q=%E5%85%AC%E9%97%9C',
  'https://www.accupass.com/search?q=%E6%95%B4%E5%90%88%E8%A1%8C%E9%8A%B7',
  'https://www.accupass.com/search?q=%E6%B4%BB%E5%8B%95%E4%BC%81%E5%8A%83',
  'https://www.accupass.com/search?q=%E4%BC%81%E6%A5%AD%E8%AC%9B%E5%BA%A7',
  'https://www.accupass.com/search?q=%E5%B7%A5%E4%BD%9C%E5%9D%8A',
  'https://www.accupass.com/search?q=%E6%9C%83%E5%B1%95',
  'https://www.accupass.com/search?q=%E5%93%81%E7%89%8C%E6%B4%BB%E5%8B%95'
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const decodeHtml = (value = '') => value
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&nbsp;/g, ' ')
  .replace(/<!-- -->/g, '')

const stripHtml = (value = '') => decodeHtml(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const unique = (items) => Array.from(new Set(items.filter(Boolean)))

async function fetchText(url) {
  const response = await fetch(url, { headers })

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`)
  }

  return response.text()
}

function extractEmails(text) {
  return unique(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
}

function extractPhones(text) {
  const matches = text.match(/(?:0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{3,4}(?:#\d+)?|09\d{2}[-\s]?\d{3}[-\s]?\d{3})/g) || []

  return unique(matches.map((phone) => phone.replace(/\s+/g, '')))
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern)

    if (match?.[1]) {
      return stripHtml(match[1]).replace(/[，,。；;：:]+$/, '').trim()
    }
  }

  return ''
}

function normalizeDate(value) {
  const text = value.replace(/[./年]/g, '-').replace(/月/g, '-').replace(/日/g, '')
  const match = text.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/)

  if (!match) {
    return ''
  }

  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function categoryFromTitle(title) {
  if (/研討|論壇|年會|講座|分享|交流/.test(title)) return '講座 / 研討會'
  if (/課程|工作坊|營隊|訓練|研習|體驗/.test(title)) return '課程 / 工作坊'
  if (/展|市集|音樂|演出|表演/.test(title)) return '展演 / 活動'
  if (/親子|兒童|家庭/.test(title)) return '親子 / 教育活動'

  return '活動報名'
}

function scoreLead({ source, eventCount, hasContact, category }) {
  let score = 68

  if (source === 'ACCUPASS') score += 9
  if (/講座|研討|課程|工作坊|訓練|論壇/.test(category)) score += 8
  if (hasContact) score += 7
  if (eventCount > 1) score += Math.min(8, eventCount)

  return Math.min(96, score)
}

function parseAccupassSearch(html) {
  const events = new Map()
  const cardPattern = /<p class="EventCard_event-time__[^"]*">([^<]+)<\/p>[\s\S]*?<a href="(\/event\/\d+)[^"]*">[\s\S]*?<p class="EventCard_event-name__[^"]*">([\s\S]*?)<\/p>/g
  let match

  while ((match = cardPattern.exec(html))) {
    events.set(`https://www.accupass.com${match[2]}`, {
      eventUrl: `https://www.accupass.com${match[2]}`,
      latestEvent: normalizeDate(match[1]) || '未標示',
      eventName: stripHtml(match[3])
    })
  }

  return Array.from(events.values())
}

function extractJsonLd(html) {
  const matches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []

  for (const block of matches) {
    const json = block.replace(/^<script type="application\/ld\+json">/, '').replace(/<\/script>$/, '')

    try {
      const parsed = JSON.parse(decodeHtml(json))

      if (parsed?.organizer?.name) {
        return parsed
      }
    } catch {
      continue
    }
  }

  return null
}

async function scrapeAccupass() {
  const eventMap = new Map()

  for (const url of accupassSearchUrls) {
    const html = await fetchText(url)

    for (const event of parseAccupassSearch(html)) {
      eventMap.set(event.eventUrl, event)
    }

    await sleep(450)
  }

  const leads = []

  for (const event of Array.from(eventMap.values()).slice(0, 24)) {
    try {
      const html = await fetchText(event.eventUrl)
      const data = extractJsonLd(html)
      const plainText = stripHtml(html)
      const eventName = data?.name || event.eventName
      const organizer = data?.organizer?.name || firstMatch(html, [/<p class="OrgInfo_org-title__[^"]*">([\s\S]*?)<\/p>/i])
      const category = categoryFromTitle(eventName)
      const emails = unique([data?.organizer?.email, ...extractEmails(plainText)])
      const phones = extractPhones(plainText)

      if (!organizer) {
        continue
      }

      leads.push({
        company: organizer,
        source: 'ACCUPASS',
        category,
        latestEvent: normalizeDate(data?.startDate || '') || event.latestEvent,
        eventCount: 1,
        fitScore: scoreLead({ source: 'ACCUPASS', eventCount: 1, hasContact: emails.length > 0 || phones.length > 0, category }),
        contact: emails[0] || '未公開',
        phone: phones[0] || '未公開',
        website: data?.organizer?.url || event.eventUrl,
        status: '待開發',
        eventName,
        eventUrl: event.eventUrl
      })

      await sleep(350)
    } catch (error) {
      console.warn(`[ACCUPASS] skipped ${event.eventUrl}: ${error.message}`)
    }
  }

  return leads
}

function mergeLeads(rawLeads) {
  const grouped = new Map()

  for (const lead of rawLeads) {
    const key = `${lead.source}:${lead.company}`
    const existing = grouped.get(key)

    if (!existing) {
      grouped.set(key, lead)
      continue
    }

    existing.eventCount += 1
    existing.fitScore = Math.max(existing.fitScore, scoreLead({
      source: existing.source,
      eventCount: existing.eventCount,
      hasContact: existing.contact !== '未公開' || existing.phone !== '未公開',
      category: existing.category
    }))

    if (existing.contact === '未公開' && lead.contact !== '未公開') existing.contact = lead.contact
    if (existing.phone === '未公開' && lead.phone !== '未公開') existing.phone = lead.phone
    if (existing.latestEvent === '未標示' || lead.latestEvent > existing.latestEvent) {
      existing.latestEvent = lead.latestEvent
      existing.eventName = lead.eventName
      existing.eventUrl = lead.eventUrl
      existing.website = lead.website
    }
  }

  return Array.from(grouped.values())
    .map((lead) => {
      const { score: proScore, targetType } = scoreWithProfile(profile, lead)

      return {
        ...lead,
        fitScore: Math.min(99, Math.round((lead.fitScore * 0.55) + (proScore * 0.45))),
        professionalScore: proScore,
        targetType,
        industry: profile.name
      }
    })
    .filter((lead) => lead.targetType !== profile.generalLabel)
    .sort((a, b) => b.professionalScore - a.professionalScore || b.fitScore - a.fitScore || b.latestEvent.localeCompare(a.latestEvent))
}

console.log(`使用評分設定檔：${profile.name}`)
const startedAt = new Date().toISOString()
const accupassLeads = await scrapeAccupass()
const leads = mergeLeads([...accupassLeads])

await mkdir('data', { recursive: true })
await writeFile('data/leads.json', `${JSON.stringify(leads, null, 2)}\n`)
await writeFile('data/scrape-report.json', `${JSON.stringify({
  startedAt,
  finishedAt: new Date().toISOString(),
  total: leads.length,
  sources: {
    ACCUPASS: accupassLeads.length,
    KKTIX: 'Cloudflare challenge; skipped without bypass',
    '104': 'not enabled in this scraper yet'
  }
}, null, 2)}\n`)

console.log(`Fetched ${leads.length} real leads`)
