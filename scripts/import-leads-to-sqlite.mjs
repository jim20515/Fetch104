import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const dbPath = 'data/leads.sqlite'
const leadsPath = 'data/leads.json'

const escapeSql = (value) => String(value ?? '').replaceAll("'", "''")

const sqlValue = (value) => value == null ? 'NULL' : `'${escapeSql(value)}'`

const leads = JSON.parse(await readFile(leadsPath, 'utf8'))

const setupStatements = [
  'PRAGMA journal_mode = WAL;',
  'DROP TABLE IF EXISTS leads;',
  `CREATE TABLE leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    source TEXT NOT NULL,
    industry TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    contact TEXT NOT NULL DEFAULT '未公開',
    phone TEXT NOT NULL DEFAULT '未公開',
    website TEXT NOT NULL,
    official_website TEXT,
    status TEXT NOT NULL DEFAULT '待開發',
    fit_score INTEGER NOT NULL DEFAULT 0,
    professional_score INTEGER NOT NULL DEFAULT 0,
    target_type TEXT NOT NULL DEFAULT '',
    score_reason TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source, company, website)
  );`,
  'CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);',
  'CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads(industry);',
  'CREATE INDEX IF NOT EXISTS idx_leads_fit_score ON leads(fit_score);',
  'CREATE INDEX IF NOT EXISTS idx_leads_professional_score ON leads(professional_score);',
  'CREATE INDEX IF NOT EXISTS idx_leads_target_type ON leads(target_type);'
]

let result = spawnSync('sqlite3', [dbPath], {
  input: setupStatements.join('\n'),
  encoding: 'utf8'
})

if (result.status !== 0) {
  console.error(result.stderr)
  process.exit(result.status ?? 1)
}

const statements = ['BEGIN;']

for (const lead of leads) {
  const metadata = JSON.stringify(lead.metadata || {})

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
    ${sqlValue(lead.source)},
    ${sqlValue(lead.industry || '')},
    ${sqlValue(lead.category || '')},
    ${sqlValue(lead.contact || '未公開')},
    ${sqlValue(lead.phone || '未公開')},
    ${sqlValue(lead.website)},
    ${sqlValue(lead.status || '待開發')},
    ${Number(lead.fitScore) || 0},
    ${Number(lead.professionalScore) || 0},
    ${sqlValue(lead.targetType || '')},
    ${sqlValue(metadata)},
    CURRENT_TIMESTAMP
  )
  ON CONFLICT(source, company, website) DO UPDATE SET
    industry = excluded.industry,
    category = excluded.category,
    contact = excluded.contact,
    phone = excluded.phone,
    status = excluded.status,
    fit_score = excluded.fit_score,
    professional_score = excluded.professional_score,
    target_type = excluded.target_type,
    metadata = excluded.metadata,
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
