import accupass from './accupass.mjs'

const SOURCES = {
  [accupass.id]: accupass
}

export function listSources() {
  return Object.values(SOURCES).map(({ id, name, supportsKeywordSearch }) => ({ id, name, supportsKeywordSearch }))
}

export function getSource(id) {
  const source = SOURCES[id]

  if (!source) {
    throw new Error(`找不到資料來源：${id}`)
  }

  return source
}
