# MEDD — Medicamentos No Utilizados

Aplicación web para el registro y análisis de medicamentos no utilizados en hogares, diseñada para el trabajo de campo del Programa de Regencia en Farmacia.

## Stack

| Capa | Tecnología |
|------|-----------|
| UI | React 18 + TypeScript |
| Bundler | Vite 8 |
| Estado | Zustand |
| Formularios | React Hook Form + Zod |
| Persistencia | IndexedDB (via `idb`) |
| Gráficos | Recharts |
| API medicamentos | CUM-INVIMA (datos.gov.co) |

## Estructura del proyecto

```
src/
  types/         # Tipos TypeScript del dominio
  lib/
    constants.ts # Opciones de campos, URL API
    db.ts        # Capa de acceso IndexedDB
    store.ts     # Estado global (Zustand)
    utils.ts     # Fecha, UUID, CSV export
    validators.ts# Esquemas Zod por paso del wizard
  hooks/
    useCUM.ts    # Hook React para la API CUM-INVIMA
  components/
    ui/          # Primitivos: Button, Card, Chip, YesNo…
    layout/      # TopBar, BottomNav, StepBar, Toast
    survey/      # Steps 1–6 del wizard
  pages/         # Dashboard, Wizard, Encuestas, Buscar, Exportar, Ajustes
  styles/
    global.css   # Reset + tokens CSS + animaciones
  App.tsx
  main.tsx
```

## Desarrollo local

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # dist/ listo para deploy
```

## Despliegue

El `dist/` generado es un SPA estático. Compatible con:
- **Netlify**: arrastrar la carpeta `dist/` al panel
- **Vercel**: `npm run build` → deploy automático
- **GitHub Pages**: subir `dist/` como rama `gh-pages`
- **Servidor propio**: servir `dist/` con nginx/apache (configurar fallback a `index.html`)

Nota: requiere HTTPS para que IndexedDB y `crypto.randomUUID()` funcionen correctamente.

## Persistencia

Los datos se almacenan en **IndexedDB** del navegador. Sobreviven cierres de pestaña y reinicios del navegador. No se sincronizan entre dispositivos ni usuarios. Para compartir datos, use la función de exportación (CSV/JSON).

## Privacidad

La app no envía datos a ningún servidor externo, excepto las consultas opcionales a la API pública CUM-INVIMA (`datos.gov.co`) para la búsqueda de medicamentos.
