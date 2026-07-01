import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const dbPath = 'data/leads.sqlite'
const leadsPath = 'data/leads.json'

const escapeSql = (value) => String(value ?? '').replaceAll("'", "''")

const sqlValue = (value) => value == null ? 'NULL' : `'${escapeSql(value)}'`

const leads = JSON.parse(await readFile(leadsPath, 'utf8'))

const setupStatements = [
  'PRAGMA journal_mode = WAL;',
  `CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    source TEXT NOT NULL,
    category TEXT NOT NULL,
    latest_event TEXT NOT NULL,
    event_count INTEGER NOT NULL DEFAULT 1,
    fit_score INTEGER NOT NULL DEFAULT 0,
    contact TEXT NOT NULL DEFAULT '未公開',
    phone TEXT NOT NULL DEFAULT '未公開',
    website TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '待開發',
    event_name TEXT,
    event_url TEXT,
    professional_score INTEGER NOT NULL DEFAULT 0,
    target_type TEXT NOT NULL DEFAULT '一般活動',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source, company, event_url)
  );`,
  'CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);',
  'CREATE INDEX IF NOT EXISTS idx_leads_fit_score ON leads(fit_score);',
  'CREATE INDEX IF NOT EXISTS idx_leads_latest_event ON leads(latest_event);'
]

let result = spawnSync('sqlite3', [dbPath], {
  input: setupStatements.join('\n'),
  encoding: 'utf8'
})

if (result.status !== 0) {
  console.error(result.stderr)
  process.exit(result.status ?? 1)
}

const columnsResult = spawnSync('sqlite3', [dbPath, 'PRAGMA table_info(leads);'], {
  encoding: 'utf8'
})
const existingColumns = new Set(columnsResult.stdout.split('\n').map((line) => line.split('|')[1]).filter(Boolean))
const migrationStatements = []

if (!existingColumns.has('professional_score')) {
  migrationStatements.push("ALTER TABLE leads ADD COLUMN professional_score INTEGER NOT NULL DEFAULT 0;")
}

if (!existingColumns.has('target_type')) {
  migrationStatements.push("ALTER TABLE leads ADD COLUMN target_type TEXT NOT NULL DEFAULT '一般活動';")
}

if (!existingColumns.has('industry')) {
  migrationStatements.push("ALTER TABLE leads ADD COLUMN industry TEXT NOT NULL DEFAULT '活動會展';")
}

if (!existingColumns.has('score_reason')) {
  migrationStatements.push('ALTER TABLE leads ADD COLUMN score_reason TEXT;')
}

if (!existingColumns.has('official_website')) {
  migrationStatements.push('ALTER TABLE leads ADD COLUMN official_website TEXT;')
}

if (migrationStatements.length > 0) {
  result = spawnSync('sqlite3', [dbPath], {
    input: migrationStatements.join('\n'),
    encoding: 'utf8'
  })

  if (result.status !== 0) {
    console.error(result.stderr)
    process.exit(result.status ?? 1)
  }
}

result = spawnSync('sqlite3', [dbPath], {
  input: [
    'CREATE INDEX IF NOT EXISTS idx_leads_professional_score ON leads(professional_score);',
    'CREATE INDEX IF NOT EXISTS idx_leads_target_type ON leads(target_type);'
  ].join('\n'),
  encoding: 'utf8'
})

if (result.status !== 0) {
  console.error(result.stderr)
  process.exit(result.status ?? 1)
}

const statements = [
  'BEGIN;',
  'DELETE FROM leads;'
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
    ${sqlValue(lead.source)},
    ${sqlValue(lead.category)},
    ${sqlValue(lead.latestEvent)},
    ${Number(lead.eventCount) || 1},
    ${Number(lead.fitScore) || 0},
    ${sqlValue(lead.contact || '未公開')},
    ${sqlValue(lead.phone || '未公開')},
    ${sqlValue(lead.website)},
    ${sqlValue(lead.status || '待開發')},
    ${sqlValue(lead.eventName)},
    ${sqlValue(lead.eventUrl)},
    ${Number(lead.professionalScore) || 0},
    ${sqlValue(lead.targetType || '一般活動')},
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

result = spawnSync('sqlite3', [dbPath], {
  input: statements.join('\n'),
  encoding: 'utf8'
})

if (result.status !== 0) {
  console.error(result.stderr)
  process.exit(result.status ?? 1)
}

const count = spawnSync('sqlite3', [dbPath, 'SELECT COUNT(*) FROM leads;'], {
  encoding: 'utf8'
})

console.log(`Imported ${count.stdout.trim()} leads into ${dbPath}`)
