import { escapeSql, executeSql } from '../utils/sqlite'

const sqlValue = (value: unknown) => value == null || value === '' ? 'NULL' : `'${escapeSql(value)}'`

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body?.company || !body?.source || !body?.website) {
    throw createError({
      statusCode: 400,
      statusMessage: 'company, source, and website are required'
    })
  }

  executeSql(`
    INSERT INTO leads (
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
      industry,
      updated_at
    ) VALUES (
      ${sqlValue(body.company)},
      ${sqlValue(body.source)},
      ${sqlValue(body.category || '活動報名')},
      ${sqlValue(body.latestEvent || '未標示')},
      ${Number(body.eventCount) || 1},
      ${Number(body.fitScore) || 0},
      ${sqlValue(body.contact || '未公開')},
      ${sqlValue(body.phone || '未公開')},
      ${sqlValue(body.website)},
      ${sqlValue(body.status || '待開發')},
      ${sqlValue(body.eventName)},
      ${sqlValue(body.eventUrl || body.website)},
      ${Number(body.professionalScore) || 0},
      ${sqlValue(body.targetType || '一般活動')},
      ${sqlValue(body.industry || '活動會展')},
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
      industry = excluded.industry,
      updated_at = CURRENT_TIMESTAMP;
  `)

  return { ok: true }
})
