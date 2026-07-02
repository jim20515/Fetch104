import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const dbPath = 'data/leads.sqlite'
const leadsPath = 'data/leads-104.json'

const escapeSql = (value) => String(value ?? '').replaceAll("'", "''")
const sqlValue = (value) => value == null || value === '' ? 'NULL' : `'${escapeSql(value)}'`
const leads = JSON.parse(await readFile(leadsPath, 'utf8'))

const statements = [
  'BEGIN;'
]

for (const lead of leads) {
  const metadata = JSON.stringify({
    eventName: lead.eventName || '104 職缺搜尋',
    eventUrl: lead.eventUrl || lead.website,
    latestEvent: lead.latestEvent || '2026-06-26',
    eventCount: Number(lead.eventCount) || 1
  })

  statements.push(`INSERT INTO leads (
    company,
    source,
    industry,
    category,
    contact,
    phone,
    website,
    status,
    fit_score,
    professional_score,
    target_type,
    metadata,
    updated_at
  ) VALUES (
    ${sqlValue(lead.company)},
    ${sqlValue(lead.source || '104')},
    ${sqlValue(lead.industry || '活動會展')},
    ${sqlValue(lead.category || '104 招募訊號')},
    ${sqlValue(lead.contact || '未公開')},
    ${sqlValue(lead.phone || '未公開')},
    ${sqlValue(lead.website)},
    ${sqlValue(lead.status || '待開發')},
    ${Number(lead.fitScore) || 0},
    ${Number(lead.professionalScore) || 0},
    ${sqlValue(lead.targetType || '專業主辦')},
    ${sqlValue(metadata)},
    CURRENT_TIMESTAMP
  )
  ON CONFLICT(source, company, website) DO UPDATE SET
    industry = excluded.industry,
    category = excluded.category,
    fit_score = excluded.fit_score,
    contact = excluded.contact,
    phone = excluded.phone,
    status = excluded.status,
    metadata = excluded.metadata,
    professional_score = excluded.professional_score,
    target_type = excluded.target_type,
    updated_at = CURRENT_TIMESTAMP;`)
}

statements.push('COMMIT;')

const result = spawnSync('sqlite3', [dbPath], {
  input: statements.join('\n'),
  encoding: 'utf8'
})

if (result.status !== 0) {
  console.error(result.stderr)
  process.exit(result.status ?? 1)
}

const count = spawnSync('sqlite3', [dbPath, "SELECT COUNT(*) FROM leads WHERE source = '104';"], {
  encoding: 'utf8'
})

console.log(`Imported ${count.stdout.trim()} 104 leads into ${dbPath}`)
