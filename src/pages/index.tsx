// Barrel of named exports for the top-level page views, used by the co-located
// page tests (src/pages/index.test.tsx). App.tsx itself loads each page as its
// own lazy chunk (see the `loadRoute` map there), so it does not import this
// barrel — keeping every route out of the initial bundle.
export { WizardPage } from './WizardPage'
export { EncuestasPage } from './EncuestasPage'
export { BuscarPage } from './BuscarPage'
export { ExportarPage } from './ExportarPage'
export { AjustesPage } from './AjustesPage'
