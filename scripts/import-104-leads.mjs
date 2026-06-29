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
  statements.push(`INSERT INTO leads (
    company,
    source,
    category,
    latest_event,
    event_count,
    fit_score,
    contact,
    phone,
    website,
    status,
    event_name,
    event_url,
    professional_score,
    target_type,
    updated_at
  ) VALUES (
    ${sqlValue(lead.company)},
    ${sqlValue(lead.source || '104')},
    ${sqlValue(lead.category || '104 招募訊號')},
    ${sqlValue(lead.latestEvent || '2026-06-26')},
    ${Number(lead.eventCount) || 1},
    ${Number(lead.fitScore) || 0},
    ${sqlValue(lead.contact || '未公開')},
    ${sqlValue(lead.phone || '未公開')},
    ${sqlValue(lead.website)},
    ${sqlValue(lead.status || '待開發')},
    ${sqlValue(lead.eventName || '104 職缺搜尋')},
    ${sqlValue(lead.eventUrl || lead.website)},
    ${Number(lead.professionalScore) || 0},
    ${sqlValue(lead.targetType || '專業主辦')},
    CURRENT_TIMESTAMP
  )
  ON CONFLICT(source, company, event_url) DO UPDATE SET
    category = excluded.category,
    latest_event = excluded.latest_event,
    event_count = excluded.event_count,
    fit_score = excluded.fit_score,
    contact = excluded.contact,
    phone = excluded.phone,
    website = excluded.website,
    status = excluded.status,
    event_name = excluded.event_name,
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
