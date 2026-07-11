import salary from './salary.mjs'
import source104 from './104.mjs'
import gcis from './gcis.mjs'
import yourator from './yourator.mjs'
import source518 from './518.mjs'

const SOURCES = {
  [salary.id]: salary,
  [source104.id]: source104,
  [gcis.id]: gcis,
  [yourator.id]: yourator,
  [source518.id]: source518
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
