# Monitoreo y control de calidad — hoja de ruta

Diseño de los controles antifraude / calidad que quedan por construir, sobre la
arquitectura actual (offline-first, IndexedDB + Supabase con RLS, panel del
investigador). Pensado para activarse **antes del go-live** (la app sigue en
piloto; el aislamiento `data_env` se aplica en el cutover, ver
`supabase/migrations/011_data_env_rls_cutover.sql`).

## Ya implementado (referencia)
- **Para-data de duración**: `surveys.started_at` (migración 009) → duración =
  `created_at − started_at`. Expuesta en la tarjeta "Control de calidad por
  encuestador" y en el CSV (`startedAt`, `duracion_s`).
- **Señales por encuestador**: completitud, straightlining, prevalencia vs. pool,
  duración mediana, entrevistas "demasiado rápidas", preferencia de dígito
  terminal del peso (`terminalDigitTest`).
- **Separación piloto/prod**: `data_env` por cuenta + trigger server-side
  (migración 010); aislamiento RLS en el cutover (011).
- **Back-check (re-entrevista de control)** — ✅ **implementado** (ver §1):
  `surveys.backcheck_of` (migración 012), captura ciega desde "Registros"
  (`openBackcheckWizard`), y tarjeta "Concordancia de back-check" (κ de Cohen
  sobre ítems Sí/No, % de acuerdo categórico, Δ peso). Pendiente: muestreo
  aleatorio automático (P3) y consentimiento de recontacto a nivel de protocolo.

---

## 1. Flujo de back-check (re-entrevista) — ✅ IMPLEMENTADO (P1–P2)

**Estado.** P1 (modelo + captura ciega + enlace) y P2 (tarjeta de concordancia
κ/acuerdo/Δpeso) implementados. P3 (muestreo aleatorio automático) pendiente.

**Objetivo.** Detectar fabricación (*curbstoning*) y medir la fiabilidad
inter-observador re-entrevistando una submuestra aleatoria (~10%) con un
supervisor y comparando respuestas con el original.

**Modelo de datos.**
- `surveys.backcheck_of uuid null references surveys(id)` — un back-check es una
  encuesta normal que apunta al original. `is_backcheck := backcheck_of is not null`.
- Índice en `backcheck_of`. RLS: el supervisor/investigador lee original + back-check.
- El registro de back-check se captura con el mismo asistente pero **ciego** a las
  respuestas del original (para no inducir concordancia).

**Muestreo.** Selección aleatoria de ~10% de encuestas elegibles (completas, no ya
back-checkeadas). Fase 1: el supervisor elige de una lista. Fase 3: función
server-side que sortea elegibles de forma reproducible (seed por semana).

**UX.** Rol supervisor → "Back-checks pendientes" → abre re-captura enlazada al
original → al guardar, `backcheck_of = original`. Tarjeta de concordancia por
campo y por encuestador.

**Métricas de concordancia** (original vs back-check, por campo):
- Categórico nominal → **κ de Cohen**. Ordinal → **κ ponderado**.
- Continuo (peso) → **ICC(2,1)** de acuerdo (aquí sí es de acuerdo: el mismo hogar
  medido dos veces).
- Binario → % de acuerdo + κ.
- Agregado por encuestador → baja concordancia = bandera de auditoría.

**Privacidad.** El back-check **recontacta al hogar** → requiere consentimiento en
la entrevista original ("podríamos recontactarlo para control de calidad").

**Fases.** P1: columna + flag + selección manual + captura ciega. P2: tarjeta de
concordancia (κ/ICC por campo y encuestador). P3: muestreo aleatorio automático.

---

## 2. GPS / geovalidación

**Objetivo.** Confirmar que las entrevistas ocurren en ubicaciones plausibles,
detectar **geoclustering** (muchas "entrevistas" en un mismo punto = fabricación) y
habilitar análisis espacial.

**Privacidad (crítico — primero).** Las coordenadas de una vivienda son **dato
personal sensible** (Colombia, Ley 1581/2012 Habeas Data). Requisitos:
- **Opt-in explícito** por entrevista (consentimiento informado).
- Acceso restringido por RLS (solo investigador/supervisor ven coordenadas).
- Política de **retención/anonimización** documentada; considerar reducir
  precisión si el análisis no requiere exactitud de vivienda.
- Las coordenadas también respetan `data_env` (piloto vs prod).

**Modelo de datos.** `geo_lat`, `geo_lng` (double precision), `geo_accuracy_m`,
`geo_consent boolean` — nullable, solo si hay consentimiento. Capturadas al abrir
el asistente vía `navigator.geolocation` (asíncrono, no bloqueante; denegación o
timeout → null).

**Monitoreo.**
- **Plausibilidad**: distancia al centroide del `ciudad` declarado (bandera si
  está lejos).
- **Geoclustering**: varias entrevistas dentro de X metros / coordenadas idénticas
  → señal de fabricación.
- **Mapa** (fase posterior): hotspots y dispersión por encuestador.

**Fases.** P1: consentimiento + captura opcional + almacenamiento (RLS). P2: QC de
geoclustering/plausibilidad. P3: visualización en mapa.

---

## 3. Sesgo de selección (recordatorio — fuera de la app)
La app no controla el muestreo. Antes del go-live, definir y **registrar**: marco y
método de muestreo, regla de selección del hogar, no-respuesta (contactos/rechazos
y motivos → tasa AAPOR) y, si las probabilidades difieren, **pesos** de
post-estratificación contra referencias DANE. El panel del investigador hoy es
**no ponderado** (declararlo en los informes).
