# MEDD · RBQM · Fase 4 — Changelog, verificación y control

> Qué cambió, evidencia de no-regresión, QTLs implementados y qué queda pendiente
> o requiere decisión. Alcance aprobado por el stakeholder (2026-07-25): **llenar
> solo los huecos reales** sin tocar lo que ya funciona en producción (R1, R6 y las
> partes ya cumplidas de R4/R5 de la auditoría previa `docs/medd-audit`).

## Estado de la suite y build

- **386 tests en verde** (33 archivos; +25 sobre la línea base de 361).
- `tsc -b` + `vite build` OK; `eslint` sin errores (solo advertencias preexistentes).
- CI (`frontend-ci.yml`) sin cambios de pipeline.

## Evidencia de NO-REGRESIÓN sobre el CSV histórico REAL

El stakeholder aportó `MEDD_20260721.csv` (n=114, con PII). **No se versiona crudo**
(direcciones, salud). Se validó `parseSurveysCSV` localmente contra el archivo real
tras todos los cambios (incluido el nuevo 7º subcampo `fuenteObtencion` en la celda
`medications`):

| Métrica (dato real, n=114) | Resultado | Coincide con el informe |
|---|---|---|
| Filas parseadas | 114/114 | ✔ n=114 |
| `instrumentVersion` tras parse | 105 v1 + 9 v2, **0 nulas** | ✔ 105/114 nulas → normalizadas |
| `fEta`=2012 (defecto) | 1 | ✔ año 2012 |
| Medicamentos parseados | 94 | ✔ |
| Ítems con `fuenteObtencion` | 0 | ✔ (v1/v2 no la capturaban) |
| `assertVersioned` | PASA | ✔ barrera de export intacta |

El parser de **7 subcampos** lee sin problema las celdas históricas de **5 subcampos**
(mapeo por posición tolerante). El test de regresión versionado corre en CI contra el
fixture des-identificado (`src/test/fixtures/MEDD_pilot_sample.csv`) + un caso v3 nuevo.

## Validación de migraciones en Postgres 16 (misma versión que Supabase)

Las migraciones `021`–`025` se aplicaron en una **instancia Postgres 16 local
desechable** (el plan Free no permite branches de BD), sembrada con datos tipo-piloto
(incluida la fila `fEta=2012`). Resultado:

- **Aplican limpio y son idempotentes** (2ª pasada sin efecto).
- **R7 (021):** el histórico `fEta=2012` se **preserva** (grandfathering `NOT VALID`);
  las escrituras nuevas con fecha 2012, fecha futura, o edad > 110 se **rechazan**.
- **R4 (022):** catálogo DANE sembrado (**1.122** municipios); FK de municipio válida
  aceptada / inválida rechazada; CHECK «Otro» bidireccional (texto sin «Otro» y «Otro»
  sin texto ambos rechazados).
- **R5 (023):** inventario materializado desde el `jsonb` y **re-explotado en UPDATE**;
  vista de estado de vencimiento correcta (`vencido`/`vigente`).
- **PII (024):** la vista desidentificada expone seudónimos estables y **0** columnas
  de PII directa (`dir`/`nui_etr`/`obs`/institución/`hogar_id` crudo).
- **Monitoreo (025):** `v_qtl_dashboard` renderiza una fila por QTL con `en_alarma`.

## ✅ Aplicado a PRODUCCIÓN (proyecto `MEDD-App`, Postgres 17) el 2026-07-25

Con tu autorización de proceder de forma segura, se aplicaron `021`–`026` a la base
viva **tras confirmar que son puramente aditivas** (ninguna modifica ni borra filas de
`surveys`). Hallazgo clave durante el pre-flight (cláusula anti-alucinación): en prod
`disp_final`/`mot_no_consumo`/`mot_vencimiento` son **jsonb**, no `text[]` — se corrigió
el CHECK «Otro» a `jsonb_exists` antes de aplicar. Verificación post-aplicación:

- **114 encuestas intactas, 0 versiones nulas**; catálogo DANE **1.122**; **94 ítems**
  materializados en `medicamento_item` (= los 94 medicamentos del piloto); vista
  desidentificada con **0** columnas de PII directa.
- **Test de escritura realista** (captura v3 con medicamento+fuente, `disp_final`
  «Otro»+texto, FK municipio `08001`): **la app puede seguir guardando** — el insert
  pasó, el trigger materializó el ítem (estado `vencido`), y se limpió la fila de prueba
  (cascade OK, 114/94 restaurados). **Sin regresión de acceso.**
- **Advisors de seguridad:** las 2 advertencias que introdujeron mis funciones de
  trigger (search_path mutable + SECURITY DEFINER expuesto por RPC) se cerraron con la
  migración de endurecimiento **`026`** (revoke execute + search_path fijo). Los WARN
  restantes (`is_active_member`, leaked-password) son **preexistentes**, fuera de alcance.

> Nota: `021`–`026` se aplicaron vía la API de migraciones de Supabase (nombres
> `rbqm_021…rbqm_026`). El seed de `022` se aplicó en dos partes (DDL + datos) por tamaño.
> La vista R7 (`v_qtl_r7_rango`) marca el histórico `fEta=2012` como fuera de rango: es
> la señal esperada para el investigador, no un fallo.

---

## Cambios por incremento (ordenados por RPN)

| Inc. | Riesgo | Cambio | Migración |
|---|---|---|---|
| I1 | R7 | Constraints de rango en el esquema: `f_eta≥2024-01-01`, edad 0–110 (por días), trigger de «no futura». `NOT VALID`/trigger preservan el piloto. | 021 |
| I2 | R2 | Modelo de duración `interview-timing.ts`: `E(ítems)=474+39·(ítems−1)` (ancla 474 s del stakeholder + pendiente Theil-Sen sobre el CSV real), `isRushed` al 50 %. Vista de monitoreo por encuestador. | 025 |
| I3 | R3 | Opción explícita **«No sabe»** en los multi-selects de motivos/disposición (obligatoriedad sin forzar respuestas inventadas). | — |
| I4 | R8 | **`fuenteObtencion` por medicamento** (catálogo cerrado). Toca tipo, OPT, Step5, sync (jsonb), csv (7º subcampo), parser, codebook. `INSTRUMENT_VERSION` 2→3. | 023 (columna en la hija) |
| I5 | R4 | Catálogo **`municipio_dane`** (1.122, fuente oficial) + FK `municipio_codigo` (derivada del par canónico) + CHECK «Otro». | 022 |
| I6 | R5 | Tabla hija **`medicamento_item`** materializada por trigger + vista `v_medicamento_estado`. | 023 |
| I7 | PII | Vista analítica SQL **desidentificada** `v_analitico_desidentificado` (Ley 1581). | 024 |
| I8 | Cont. | **GitHub Action de respaldo** periódico (data+schema) a artefacto/Storage, idempotente. | — |
| I9 | Verif. | Regresión sobre CSV real + vistas **`v_qtl_*`** + este changelog. | 025 |

## QTLs implementados y operables

`v_qtl_dashboard` (R1, R3, R5, R7) + `v_qtl_r2_duracion_encuestador`. Umbrales:
versión nula 0 %, completitud disposición ≥ 95 %, ítems sin vencimiento < 20 %, fuera
de rango 0. Consultables por el rol investigador desde el primer registro de la próxima
ola (`02-control-plan.md` documenta cada consulta y su escalamiento).

## Cumplimiento — Data API (Postgres grants)

> **Nota de verificación (fecha límite 2026-10-30):** para proyectos existentes,
> Supabase exige **grants explícitos de Postgres** para la Data API desde el
> 2026-10-30. Antes de esa fecha, verificar en el proyecto `MEDD-App` que los roles
> `anon`/`authenticated` conservan los grants necesarios sobre `public` (incluidas las
> tablas/vistas nuevas: `municipio_dane`, `medicamento_item`, `v_*`), para no perder el
> acceso desde la app de captura. Las nuevas tablas ya declaran su RLS; falta confirmar
> los grants a nivel de rol cuando el requisito entre en vigor.

---

## Pendiente / requiere tu decisión

1. ~~**Aplicar `021`–`025` a producción**~~ ✅ **Hecho** (`021`–`026`, verificado; ver
   sección de arriba). Sin regresión de datos ni de acceso.
2. **Umbral de R2 (piso del 50 %)** — implementado como constante configurable
   (`RUSHED_FRACTION`). Ajústalo si tu criterio difiere.
3. **Para-data por bloque (R2)** — **diferido con fundamento**: el piloto solo tiene
   duración TOTAL, así que no hay distribución por bloque para calibrar mínimos por
   sección sin adivinar. Se entregó el modelo de duración total (tu ancla 474 s), la
   vista por encuestador y el QTL. Instrumentar timestamps por bloque en el asistente
   se recomienda para la próxima ola, momento en que sí podrán fijarse mínimos por
   sección con dato propio. ¿Autorizas esa instrumentación para la siguiente versión?
4. **`atc_codigo` en `medicamento_item`** — columna reservada, hoy NULL. La
   clasificación vive en el cliente (`atc.ts`, fuente CUM-INVIMA); persistirla de forma
   trazable en la hija se puede hacer cuando lo decidas (no se generan códigos de
   memoria).
5. **Cutover de RLS por rol para PII** — la vista desidentificada está lista; apuntar
   el rol investigador SOLO a ella (revocando su lectura directa de `surveys`) queda
   propuesto, a validar en entorno seguro para no romper la app en prod (regla de parada).
6. **Secret `SUPABASE_DB_URL`** para activar el workflow de respaldo (y opcionalmente
   `SUPABASE_SERVICE_ROLE_KEY`+`SUPABASE_BACKUP_BUCKET` para copia a Storage).
