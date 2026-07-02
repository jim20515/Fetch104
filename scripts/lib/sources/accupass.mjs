const headers = {
  'User-Agent': 'Mozilla/5.0 (compatible; LeadFinder/1.0; +https://localhost)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.7'
}

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

function scoreLead({ eventCount, hasContact, category }) {
  let score = 77

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

async function search(keywords, { onProgress } = {}) {
  const searchUrls = keywords.map((keyword) => `https://www.accupass.com/search?q=${encodeURIComponent(keyword)}`)
  const eventMap = new Map()

  for (const url of searchUrls) {
    onProgress?.(`搜尋關鍵字頁面：${url}`)
    const html = await fetchText(url)

    for (const event of parseAccupassSearch(html)) {
      eventMap.set(event.eventUrl, event)
    }

    await sleep(450)
  }

  const rawLeads = []
  const events = Array.from(eventMap.values()).slice(0, 24)

  for (const [index, event] of events.entries()) {
    try {
      onProgress?.(`讀取活動頁 ${index + 1}/${events.length}`)
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

      const latestEvent = normalizeDate(data?.startDate || '') || event.latestEvent

      rawLeads.push({
        company: organizer,
        source: 'ACCUPASS',
        category,
        fitScore: scoreLead({ eventCount: 1, hasContact: emails.length > 0 || phones.length > 0, category }),
        contact: emails[0] || '未公開',
        phone: phones[0] || '未公開',
        website: data?.organizer?.url || event.eventUrl,
        status: '待開發',
        metadata: {
          eventName,
          eventUrl: event.eventUrl,
          latestEvent,
          eventCount: 1
        }
      })

      await sleep(350)
    } catch (error) {
      onProgress?.(`[ACCUPASS] 略過 ${event.eventUrl}：${error.message}`)
    }
  }

  const grouped = new Map()

  for (const lead of rawLeads) {
    const key = `${lead.source}:${lead.company}`
    const existing = grouped.get(key)

    if (!existing) {
      grouped.set(key, lead)
      continue
    }

    existing.metadata.eventCount += 1
    existing.fitScore = Math.max(existing.fitScore, scoreLead({
      eventCount: existing.metadata.eventCount,
      hasContact: existing.contact !== '未公開' || existing.phone !== '未公開',
      category: existing.category
    }))

    if (existing.contact === '未公開' && lead.contact !== '未公開') existing.contact = lead.contact
    if (existing.phone === '未公開' && lead.phone !== '未公開') existing.phone = lead.phone
    if (existing.metadata.latestEvent === '未標示' || lead.metadata.latestEvent > existing.metadata.latestEvent) {
      existing.metadata.latestEvent = lead.metadata.latestEvent
      existing.metadata.eventName = lead.metadata.eventName
      existing.metadata.eventUrl = lead.metadata.eventUrl
      existing.website = lead.website
    }
  }

  return Array.from(grouped.values())
}

export default {
  id: 'ACCUPASS',
  name: 'ACCUPASS 活動平台',
  supportsKeywordSearch: true,
  search
}
