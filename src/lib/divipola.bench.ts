import { bench, describe } from 'vitest'
import { lookupDepartamento, lookupCodigo } from './divipola'

describe('lookupDepartamento', () => {
  bench('lookup known unique', () => {
    lookupDepartamento('Barranquilla')
  })
  bench('lookup known ambiguous', () => {
    lookupDepartamento('Sabanalarga')
  })
  bench('lookup unknown', () => {
    lookupDepartamento('Ciudad Inexistente')
  })
})

describe('lookupCodigo', () => {
  bench('lookup known unique', () => {
    lookupCodigo('Barranquilla')
  })
  bench('lookup known ambiguous', () => {
    lookupCodigo('Sabanalarga')
  })
  bench('lookup known ambiguous with dept', () => {
    lookupCodigo('Sabanalarga', 'Atlántico')
  })
  bench('lookup unknown', () => {
    lookupCodigo('Ciudad Inexistente')
  })
})
