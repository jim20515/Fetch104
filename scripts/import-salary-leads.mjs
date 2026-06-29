import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const dbPath = 'data/leads.sqlite'
const leadsPath = 'data/leads-salary.json'

const escapeSql = (value) => String(value ?? '').replaceAll("'", "''")
const sqlValue = (value) => (value == null || value === '') ? 'NULL' : `'${escapeSql(value)}'`

const leads = JSON.parse(await readFile(leadsPath, 'utf8'))

const statements = ['BEGIN;']

for (const lead of leads) {
  statements.push(`INSERT INTO leads (
    company, source, category, latest_event, event_count,
    fit_score, contact, phone, website, status,
    event_name, event_url, professional_score, target_type, updated_at
  ) VALUES (
    ${sqlValue(lead.company)},
    ${sqlValue('salary.tw')},
    ${sqlValue('廣告行銷公關業')},
    ${sqlValue(lead.latestEvent || new Date().toISOString().slice(0, 10))},
    ${Number(lead.eventCount) || 1},
    ${Number(lead.fitScore) || 50},
    ${sqlValue('未公開')},
    ${sqlValue(lead.phone && lead.phone !== '未公開' ? lead.phone : '未公開')},
    ${sqlValue(lead.website)},
    ${sqlValue('待開發')},
    ${sqlValue('salary.tw 廣告行銷公關業名錄')},
    ${sqlValue(lead.website)},
    ${Number(lead.professionalScore) || 50},
    ${sqlValue(lead.targetType || '可觀察')},
    CURRENT_TIMESTAMP
  )
  ON CONFLICT(source, company, event_url) DO UPDATE SET
    phone = CASE WHEN excluded.phone != '' THEN excluded.phone ELSE leads.phone END,
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

const count = spawnSync('sqlite3', [dbPath, "SELECT COUNT(*) FROM leads WHERE source = 'salary.tw';"], {
  encoding: 'utf8'
})

console.log(`✓ 匯入完成：${count.stdout.trim()} 筆 salary.tw 資料進入 ${dbPath}`)
