const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function buildPattern(keywords) {
  const list = (keywords || []).filter(Boolean)
  if (list.length === 0) return null
  return new RegExp(list.map(escapeRegExp).join('|'), 'i')
}

export function scoreWithProfile(profile, { company, category = '', businessText = '', signalCount = 1 }) {
  const companyText = `${company}`
  const bizText = `${category} ${businessText}`
  const text = `${companyText} ${bizText}`

  const companyPattern = buildPattern(profile.companyKeywords)
  const businessPattern = buildPattern(profile.businessKeywords)
  const excludePattern = buildPattern(profile.excludeKeywords)

  let score = 0

  if (companyPattern?.test(companyText)) score += 45
  if (signalCount > 1) score += Math.min(40, 22 + signalCount * 5)
  if (businessPattern?.test(bizText)) score += 18
  if (excludePattern?.test(text)) score -= 28

  score = Math.max(0, Math.min(100, score))

  const targetType = score >= profile.proThreshold
    ? profile.proLabel
    : score >= profile.observableThreshold
      ? profile.observableLabel
      : profile.generalLabel

  return { score, targetType }
}
