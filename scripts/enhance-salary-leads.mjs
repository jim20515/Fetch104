/**
 * 強化 salary.tw 名單品質
 * A. 關鍵字過濾：負面關鍵字標記非活動公司，正面關鍵字加分
 * B. ACCUPASS/BeClass cross-reference：有辦過活動的公司大幅加分
 */
import { spawnSync } from 'node:child_process'

const dbPath = 'data/leads.sqlite'

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

// ── 負面關鍵字：這些類型的公司不辦活動 ──────────────────────────────────
const NEGATIVE_PATTERNS = [
  // 純數位/科技（不含整合行銷）
  /網路科技|移動科技|數位科技|資訊科技|科技有限公司(?!.*整合)|App科技|智慧科技/,
  // 軟體/系統/雲端
  /軟體開發|系統開發|ERP|SaaS|雲端服務|資訊系統|程式設計|技術服務/,
  // 純電商/物流
  /電商平台|電商代營運|跨境電商|物流|倉儲|快遞/,
  // 純數位廣告投放（沒有活動/整合行銷字眼）
  /程序化廣告|媒體採購|媒體代理|廣告科技|AdTech|DSP|DMP/,
  // 保險/金融/不動產
  /保險代理|壽險|產險|人壽|金融顧問|投資顧問|基金|房地產|建設開發/,
  // 遊戲/娛樂內容（非活動辦理）
  /遊戲有限公司|遊戲股份|手遊|電玩|娛樂內容/,
  // SEO/關鍵字廣告
  /SEO顧問|關鍵字廣告|搜尋引擎優化/,
  // 純 KOL/網紅平台（非活動公司）
  /網紅行銷|KOL媒合|網紅經紀(?!.*整合)/,
  // 創作者訂閱平台
  /訂閱平台|內容平台|知識平台/,
]

// ── 正面關鍵字：這些強烈暗示有在辦活動 ────────────────────────────────
const POSITIVE_SCORES = [
  { pattern: /公關|公共關係|公關顧問|PR(?!\w)/, score: 32 },   // 公關直接推上 72+
  { pattern: /整合行銷|整合傳播|整合媒體/, score: 30 },         // 整合行銷通常辦活動
  { pattern: /活動(?!用品|型|式|量)/, score: 30 },  // 含「活動」的公司名
  { pattern: /會展|展覽|策展|博覽會|展演|展示/, score: 28 },    // 展覽類（展覽 not 展覽公司）
  { pattern: /品牌活動|品牌傳播|品牌體驗|品牌整合/, score: 18 },
  { pattern: /尾牙|春酒|年會|年終|記者會|發表會|論壇|研討/, score: 20 },
  { pattern: /廣告公司|廣告股份|廣告有限|廣告顧問/, score: 10 },
  { pattern: /傳播顧問|媒體公關|媒體策略|行銷傳播/, score: 12 },
]

// ── 從 ACCUPASS/BeClass/104 抓公司名詞語，供模糊比對 ─────────────────
const eventCompanies = runSql(`
  SELECT DISTINCT company FROM leads
  WHERE source IN ('ACCUPASS', 'BeClass', '104')
  AND target_type IN ('專業主辦', '可觀察')
`).map(r => r.company.replace(/[_（(][^)）]*/g, '').trim().toLowerCase())

function eventMatch(name) {
  const n = name.replace(/[_（(][^)）]*/g, '').toLowerCase()
  // 取 4 字以上的詞段做比對
  for (const en of eventCompanies) {
    const words = en.split(/[\s_、]/g).filter(w => w.length >= 4)
    if (words.some(w => n.includes(w))) return true
  }
  return false
}

// 每個正面關鍵字對應的中文標籤（用於原因說明）
const POSITIVE_LABELS = [
  { pattern: /公關|公共關係|公關顧問|PR(?!\w)/, label: '公關', score: 32 },
  { pattern: /整合行銷|整合傳播|整合媒體/, label: '整合行銷', score: 30 },
  { pattern: /活動(?!用品|型|式|量)/, label: '活動', score: 30 },
  { pattern: /會展|展覽|策展|博覽會|展演|展示/, label: '展覽/會展', score: 28 },
  { pattern: /品牌活動|品牌傳播|品牌體驗|品牌整合/, label: '品牌活動', score: 18 },
  { pattern: /尾牙|春酒|年會|年終|記者會|發表會|論壇|研討/, label: '活動類型', score: 20 },
  { pattern: /廣告公司|廣告股份|廣告有限|廣告顧問/, label: '廣告公司', score: 10 },
  { pattern: /傳播顧問|媒體公關|媒體策略|行銷傳播/, label: '傳播/媒體公關', score: 12 },
]

// 負面關鍵字對應標籤
const NEGATIVE_LABELS = [
  { pattern: /網路科技|移動科技|數位科技|資訊科技|科技有限公司(?!.*整合)|App科技|智慧科技/, label: '科技公司' },
  { pattern: /軟體開發|系統開發|ERP|SaaS|雲端服務|資訊系統|程式設計|技術服務/, label: '軟體/系統' },
  { pattern: /電商平台|電商代營運|跨境電商|物流|倉儲|快遞/, label: '電商/物流' },
  { pattern: /程序化廣告|媒體採購|媒體代理|廣告科技|AdTech|DSP|DMP/, label: '純媒體採購' },
  { pattern: /保險代理|壽險|產險|人壽|金融顧問|投資顧問|基金|房地產|建設開發/, label: '金融/保險/不動產' },
  { pattern: /遊戲有限公司|遊戲股份|手遊|電玩|娛樂內容/, label: '遊戲/娛樂內容' },
  { pattern: /SEO顧問|關鍵字廣告|搜尋引擎優化/, label: 'SEO/關鍵字廣告' },
  { pattern: /網紅行銷|KOL媒合|網紅經紀(?!.*整合)/, label: 'KOL平台' },
  { pattern: /訂閱平台|內容平台|知識平台/, label: '內容/訂閱平台' },
]

// ── 重新評分邏輯 ────────────────────────────────────────────────────────
function rescoreLead(name) {
  const n = name
  const reasons = []

  // 負面：標記為一般活動，分數壓低
  for (const { pattern, label } of NEGATIVE_LABELS) {
    if (pattern.test(n)) {
      return {
        score: 20,
        targetType: '一般活動',
        scoreReason: `非活動業者（${label}）`,
        reason: '負面關鍵字'
      }
    }
  }

  // 基礎分
  let score = 40

  // 正面關鍵字加分
  for (const { pattern, label, score: add } of POSITIVE_LABELS) {
    if (pattern.test(n)) {
      score += add
      reasons.push(`${label} +${add}`)
    }
  }

  // cross-reference 加分（有在活動平台出現過）
  const matched = eventMatch(n)
  if (matched) {
    score += 30
    reasons.push('已知活動主辦 +30')
  }

  score = Math.min(99, score)

  const targetType = score >= 70
    ? '專業主辦'
    : score >= 45
      ? '可觀察'
      : '一般活動'

  const scoreReason = reasons.length > 0 ? reasons.join('｜') : '無明確活動關鍵字'

  return { score, targetType, scoreReason, reason: matched ? 'cross-ref命中' : '關鍵字評分' }
}

// ── 讀取 salary.tw 資料並更新 ──────────────────────────────────────────
console.log('讀取 salary.tw 資料...')
const leads = runSql(`SELECT id, company, professional_score, target_type FROM leads WHERE source = 'salary.tw'`)
console.log(`共 ${leads.length} 間，開始重新評分...`)

const stats = { 專業主辦: 0, 可觀察: 0, 一般活動: 0, crossRefHits: 0 }
const updates = []

for (const lead of leads) {
  const { score, targetType, scoreReason, reason } = rescoreLead(lead.company)
  if (reason === 'cross-ref命中') stats.crossRefHits++
  stats[targetType]++
  updates.push({ id: lead.id, score, targetType, scoreReason })
}

// 批次更新
console.log('批次更新資料庫...')
const statements = ['BEGIN;']
for (const { id, score, targetType, scoreReason } of updates) {
  statements.push(`UPDATE leads SET professional_score = ${score}, fit_score = ${score}, target_type = '${escapeSql(targetType)}', score_reason = '${escapeSql(scoreReason)}', updated_at = CURRENT_TIMESTAMP WHERE id = ${id};`)
}
statements.push('COMMIT;')
execSql(statements.join('\n'))

console.log('\n✓ 更新完成！\n')
console.log('=== salary.tw 重新評分結果 ===')
console.log(`  專業主辦：${stats.專業主辦} 間`)
console.log(`  可觀察：  ${stats.可觀察} 間`)
console.log(`  一般活動：${stats.一般活動} 間（UI 預設分數門檻以下，不會顯示）`)
console.log(`  cross-ref 命中：${stats.crossRefHits} 間（有在 ACCUPASS/BeClass/104 出現）`)
console.log()

// 顯示各類樣本
const topPro = runSql(`SELECT company, professional_score, phone FROM leads WHERE source='salary.tw' AND target_type='專業主辦' ORDER BY professional_score DESC LIMIT 8`)
console.log('=== 專業主辦 TOP 8 ===')
topPro.forEach(r => console.log(`  [${r.professional_score}] ${r.company} | ${r.phone}`))

const filtered = runSql(`SELECT company, professional_score FROM leads WHERE source='salary.tw' AND target_type='一般活動' ORDER BY RANDOM() LIMIT 5`)
console.log('\n=== 被過濾掉的樣本 ===')
filtered.forEach(r => console.log(`  [${r.professional_score}] ${r.company}`))
