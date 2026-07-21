import { TopBar } from '../components/layout'
import { Card, Button, IconChip, C } from '../components/ui'
import { useStore } from '../lib/store'
import { dateTag } from '../lib/date'
import { toCSV, toCodebookCSV } from '../lib/csv'
import { downloadBlob } from '../lib/utils'

// ─── EXPORT PAGE ──────────────────────────────────────────────────────────

export function ExportarPage() {
  const { surveys, pushToast } = useStore()
  const n = surveys.length
  const disabled = n === 0

  // Close the loop on the export: a browser download gives no visible feedback
  // (especially on mobile, where it drops silently into the download tray), so
  // confirm the action fired and how many records it covered.
  function exportCSV() {
    // toCSV aplica la barrera de versión (Rec. 1): si un registro llegara sin
    // versión declarada, lanza en vez de emitir un dataset ambiguo. Se surfacea
    // como error en lugar de descargar dato dudoso o romper la app.
    try {
      downloadBlob(toCSV(surveys), `MEDD_${dateTag()}.csv`, 'text/csv;charset=utf-8')
      pushToast(`CSV exportado · ${n} registro${n !== 1 ? 's' : ''}`, 'success')
    } catch (e) {
      pushToast(e instanceof Error ? e.message : 'No se pudo exportar el CSV', 'error')
    }
  }
  function exportCodebook() {
    downloadBlob(toCodebookCSV(), `MEDD_codebook_${dateTag()}.csv`, 'text/csv;charset=utf-8')
    pushToast('Diccionario (codebook) descargado', 'success')
  }
  function exportJSON() {
    downloadBlob(JSON.stringify(surveys, null, 2), `MEDD_${dateTag()}.json`, 'application/json')
    pushToast(`JSON exportado · ${n} registro${n !== 1 ? 's' : ''}`, 'success')
  }

  return (
    <div>
      <TopBar title="Exportar datos" subtitle="CSV · JSON · codebook" icon="ti-download" accent={C.green} />
      <div className="page-content narrow">
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>
          {n} registro{n !== 1 ? 's' : ''} en sesión actual.
          Los datos persisten en IndexedDB del navegador y sobreviven cierres de pestaña.
        </p>

        <Card className="lift" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <IconChip icon="ti-file-spreadsheet" accent={C.green} />
            <div>
              <div className="fd" style={{ fontWeight: 600, fontSize: 14.5 }}>Exportar CSV</div>
              <div style={{ fontSize: 12, color: C.muted }}>Columnas del codebook · Compatible con Excel, SPSS, R, Stata · UTF-8 BOM</div>
            </div>
          </div>
          <Button
            fullWidth disabled={disabled}
            style={{ background: disabled ? C.bg : '#3B6D11', color: disabled ? C.hint : '#fff', border: 'none' }}
            icon="ti-download"
            onClick={exportCSV}
          >
            Descargar .csv
          </Button>
          <Button
            fullWidth variant="ghost"
            style={{ marginTop: 8 }}
            icon="ti-book-2"
            onClick={exportCodebook}
          >
            Descargar diccionario (codebook)
          </Button>
        </Card>

        <Card className="lift">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <IconChip icon="ti-braces" accent={C.navy} />
            <div>
              <div className="fd" style={{ fontWeight: 600, fontSize: 14.5 }}>Exportar JSON</div>
              <div style={{ fontSize: 12, color: C.muted }}>Estructura completa con array de medicamentos · Para procesamiento programático</div>
            </div>
          </div>
          <Button
            fullWidth disabled={disabled}
            style={{ background: disabled ? C.bg : '#1D4ED8', color: disabled ? C.hint : '#fff', border: 'none' }}
            icon="ti-download"
            onClick={exportJSON}
          >
            Descargar .json
          </Button>
        </Card>
      </div>
    </div>
  )
}

