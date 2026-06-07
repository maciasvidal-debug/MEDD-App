# MEDD — Medicamentos No Utilizados

Aplicación web para el registro y análisis de medicamentos no utilizados en hogares, diseñada para el trabajo de campo del Programa de Regencia en Farmacia.

## Stack

| Capa | Tecnología |
|------|-----------|
| UI | React 19 + TypeScript |
| Bundler | Vite 8 |
| Estado | Zustand |
| Formularios | React Hook Form + Zod |
| Persistencia local | IndexedDB (via `idb`) — offline-first |
| Auth y sincronización | Supabase (Postgres + RLS) |
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

## Persistencia y sincronización

La app es **offline-first**: las encuestas se guardan primero en **IndexedDB** del navegador (sobreviven cierres de pestaña y reinicios) y se **sincronizan con Supabase** (Postgres) cuando hay conexión — al iniciar sesión, al reconectar, al volver el foco a la app y con el botón manual. Cada usuario solo ve y modifica sus propios datos (Row-Level Security); el rol `investigador` tiene lectura agregada. El perfil del encuestador también se sincroniza a la cuenta, por lo que viaja entre dispositivos.

## Privacidad

La app sincroniza las encuestas y el perfil del encuestador con el proyecto **Supabase** del estudio (Postgres con RLS por usuario). Además, realiza consultas opcionales a la API pública **CUM-INVIMA** (`datos.gov.co`) para la búsqueda de medicamentos. No comparte datos con otros terceros.

## Backend (`backend/`) — API Express independiente, **no usada por la app web**

El directorio `backend/` contiene un API Express (encuestas + analítica) con autenticación JWT de Supabase, validación y SQL parametrizado, además de su propia suite de tests y CI (`backend-ci.yml`).

**La app web (`src/`) no lo consume**: el frontend accede directamente a Supabase con RLS. Este backend es un servicio servidor *separado* —accede a Postgres con un pool privilegiado que **omite RLS**, por lo que autoriza cada petición por su cuenta— pensado para consumidores de servidor (p. ej. analítica/exportación). Actualmente **no tiene configuración de despliegue**. Si no hay un plan para usarlo, considérese archivarlo para reducir mantenimiento y superficie de credenciales.
