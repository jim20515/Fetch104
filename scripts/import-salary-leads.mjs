import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const dbPath = 'data/leads.sqlite'
const leadsPath = 'data/leads-salary.json'

const escapeSql = (value) => String(value ?? '').replaceAll("'", "''")
const sqlValue = (value) => (value == null || value === '') ? 'NULL' : `'${escapeSql(value)}'`

const leads = JSON.parse(await readFile(leadsPath, 'utf8'))

const statements = ['BEGIN;']

for (const lead of leads) {
  const metadata = JSON.stringify({
    eventName: 'salary.tw 廣告行銷公關業名錄',
    eventUrl: lead.website,
    latestEvent: lead.latestEvent || new Date().toISOString().slice(0, 10),
    eventCount: Number(lead.eventCount) || 1,
    addr: lead.addr || ''
  })

  statements.push(`INSERT INTO leads (
    company, source, industry, category,
    contact, phone, website, status,
    fit_score, professional_score, target_type, metadata, updated_at
  ) VALUES (
    ${sqlValue(lead.company)},
    ${sqlValue('salary.tw')},
    ${sqlValue(lead.industry || '活動會展')},
    ${sqlValue('廣告行銷公關業')},
    ${sqlValue('未公開')},
    ${sqlValue(lead.phone && lead.phone !== '未公開' ? lead.phone : '未公開')},
    ${sqlValue(lead.website)},
    ${sqlValue('待開發')},
    ${Number(lead.fitScore) || 50},
    ${Number(lead.professionalScore) || 50},
    ${sqlValue(lead.targetType || '可觀察')},
    ${sqlValue(metadata)},
    CURRENT_TIMESTAMP
  )
  ON CONFLICT(source, company, website) DO UPDATE SET
    phone = CASE WHEN excluded.phone != '未公開' THEN excluded.phone ELSE leads.phone END,
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

const count = spawnSync('sqlite3', [dbPath, "SELECT COUNT(*) FROM leads WHERE source = 'salary.tw';"], {
  encoding: 'utf8'
})

console.log(`✓ 匯入完成：${count.stdout.trim()} 筆 salary.tw 資料進入 ${dbPath}`)
