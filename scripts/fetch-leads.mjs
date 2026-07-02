import { mkdir, writeFile } from 'node:fs/promises'
import { loadProfile, scoreWithProfile } from './lib/scoring-profiles.mjs'
import { getSource } from './lib/sources/index.mjs'

const dbPath = 'data/leads.sqlite'

const profileArg = process.argv.find((arg) => arg.startsWith('--profile='))
const profileName = profileArg ? profileArg.slice('--profile='.length) : '活動會展'
const profile = loadProfile(dbPath, profileName)

const DEFAULT_KEYWORDS = ['公關', '整合行銷', '活動企劃', '企業講座', '工作坊', '會展', '品牌活動']
const keywordsArg = process.argv.find((arg) => arg.startsWith('--keywords='))
const keywords = keywordsArg
  ? keywordsArg.slice('--keywords='.length).split(',').map((value) => value.trim()).filter(Boolean)
  : DEFAULT_KEYWORDS

const sourceArg = process.argv.find((arg) => arg.startsWith('--source='))
const sourceId = sourceArg ? sourceArg.slice('--source='.length) : 'ACCUPASS'
const source = getSource(sourceId)

console.log(`使用來源：${source.name}，關鍵字：${keywords.join('、')}，評分設定檔：${profile.name}`)

const startedAt = new Date().toISOString()
const rawLeads = await source.search(keywords, { onProgress: (message) => console.log(message) })

const leads = rawLeads
  .map((lead) => {
    const { score, targetType } = scoreWithProfile(profile, {
      company: lead.company,
      category: lead.category,
      businessText: lead.metadata?.eventName || '',
      signalCount: lead.metadata?.eventCount || 1
    })

    return {
      ...lead,
      fitScore: Math.min(99, Math.round((lead.fitScore * 0.55) + (score * 0.45))),
      professionalScore: score,
      targetType,
      industry: profile.name
    }
  })
  .filter((lead) => lead.targetType !== profile.generalLabel)
  .sort((a, b) => b.professionalScore - a.professionalScore || b.fitScore - a.fitScore)

await mkdir('data', { recursive: true })
await writeFile('data/leads.json', `${JSON.stringify(leads, null, 2)}\n`)
await writeFile('data/scrape-report.json', `${JSON.stringify({
  startedAt,
  finishedAt: new Date().toISOString(),
  total: leads.length,
  source: source.id,
  keywords,
  profile: profile.name
}, null, 2)}\n`)

console.log(`Fetched ${leads.length} real leads`)
