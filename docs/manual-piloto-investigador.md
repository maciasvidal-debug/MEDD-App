# Manual de Pilotaje — MEDD-App
**Para el investigador principal · Versión 1.0 · Junio 2026**

---

## Índice

1. [Propósito y alcance del piloto](#1-propósito-y-alcance-del-piloto)
2. [Preparación pre-piloto](#2-preparación-pre-piloto)
3. [Prueba de caja negra (caso simulado)](#3-prueba-de-caja-negra-caso-simulado)
4. [Back-checks de campo (10 % de la muestra)](#4-back-checks-de-campo-10--de-la-muestra)
5. [Análisis de variabilidad inter-encuestador](#5-análisis-de-variabilidad-inter-encuestador)
6. [Refinamiento de preguntas](#6-refinamiento-de-preguntas)
7. [Criterios de salida del piloto (go-live checklist)](#7-criterios-de-salida-del-piloto-go-live-checklist)
8. [Anexos](#8-anexos)

---

## 1. Propósito y alcance del piloto

### 1.1 Qué se valida

El piloto tiene tres objetivos simultáneos:

| Objetivo | Evidencia esperada |
|---|---|
| **Calidad del instrumento** — las preguntas se interpretan de forma uniforme | κ ≥ 0.60 en la prueba de caja negra por ítem Sí/No |
| **Calidad del encuestador** — la captura es consistente entre observadores y a lo largo del tiempo | ICC uno-vía ≥ 0.60; duración mediana dentro de la banda esperada |
| **Calidad del flujo técnico** — la app no introduce sesgos ni pérdida de datos | 0 encuestas con errores de sincronización; 0 ítems obligatorios en blanco |

### 1.2 Etiquetado automático piloto / producción

Todas las encuestas capturadas durante el piloto llevan la marca `data_env = 'pilot'` asignada automáticamente por el servidor. Esta marca es **inmutable desde la app**: el encuestador no puede cambiarla ni verla. Las encuestas del piloto **no contaminan el dataset productivo** y permanecen disponibles para análisis metodológico incluso después del go-live.

No se requiere ninguna acción especial del encuestador ni del investigador para activar este etiquetado.

### 1.3 Parámetros mínimos recomendados

| Parámetro | Valor mínimo recomendado | Justificación |
|---|---|---|
| Encuestas piloto completadas | 30 | Potencia mínima para estimar κ con IC del 95 % |
| Encuestadores participantes | 3 | Caja negra + variabilidad |
| Duración del piloto | 2 semanas | Permite detectar fatiga y curva de aprendizaje |
| Back-checks ejecutados | ≥ 3 (≈ 10 % de 30) | Base mínima para tarjeta de concordancia |

---

## 2. Preparación pre-piloto

### 2.1 Cuentas y perfiles

1. Crear una cuenta de encuestador por cada estudiante participante en el piloto.
2. Cada encuestador debe completar su perfil en **Ajustes** antes de comenzar:
   - NUI de encuestador
   - Programa, semestre, tipo e institución de la ETR
   > La app bloquea la apertura del asistente si el perfil está incompleto. Este es un control intencional: una encuesta sin perfil no puede atribuirse a un encuestador específico.
3. El investigador verifica en el panel analítico que todos los NUI de encuestador aparezcan en la tarjeta **"Control de calidad por encuestador"** tras las primeras capturas.

### 2.2 Checklist técnico

- [ ] App instalada y abierta al menos una vez (IndexedDB inicializado)
- [ ] Credenciales probadas: inicio de sesión exitoso
- [ ] Al menos una encuesta de prueba capturada y sincronizada (`✓ Sincronizado` en la tarjeta)
- [ ] Investigador puede ver las encuestas del piloto en el panel analítico
- [ ] CSV de prueba exportado desde el panel (verificar columnas `startedAt`, `dataEnv`, `duracion_s`)

### 2.3 Comunicación a los encuestadores

Antes de comenzar el piloto comunicar explícitamente:

> "Durante el piloto usaremos la app en modo de prueba. Todos los datos que capturen están marcados como piloto y no afectan el estudio real. Su objetivo es usar la app exactamente como lo harían en campo, reportando cualquier pregunta confusa, error de la app o dificultad de captura."

---

## 3. Prueba de caja negra (caso simulado)

### 3.1 Concepto

La prueba de caja negra evalúa si el cuestionario produce respuestas consistentes independientemente de quién lo aplique. En educación a distancia no es posible entrevistar al mismo paciente simultáneamente, por lo que se usa un **caso simulado (vigneta clínica)**: el investigador elabora un perfil ficticio con respuestas predefinidas para todas las preguntas y cada encuestador captura de forma independiente como si estuviera entrevistando a ese paciente.

El encuestador **no sabe** cuáles son las respuestas esperadas — de ahí el nombre "caja negra". Las divergencias revelan ambigüedad en la pregunta o sesgo de interpretación del encuestador.

### 3.2 Cuándo correr la prueba

| Momento | Propósito |
|---|---|
| **Inicio del piloto** (antes de encuestas reales) | Detectar problemas del instrumento en versión original |
| **Tras reformular preguntas** (§6) | Verificar que los cambios mejoraron la concordancia |

### 3.3 Protocolo paso a paso

**Paso 1 — Redactar la vigneta (investigador)**

Preparar el perfil del paciente simulado usando la plantilla del [Anexo A](#anexo-a--vigneta-estándar-del-caso-simulado). El perfil debe:
- Cubrir todas las preguntas del cuestionario, incluyendo las que se activan por saltos lógicos
- Incluir una lista de medicamentos con nombre, dosis y fecha de vencimiento explícitas
- Especificar las respuestas esperadas para cada ítem (columna privada del investigador — no compartir)
- Ser clínica y sociodemográficamente coherente (no inventar combinaciones imposibles)

**Paso 2 — Distribuir la vigneta**

Enviar el texto de la vigneta a cada encuestador por el canal habitual (correo, WhatsApp, campus virtual). Instrucción explícita:

> "Lee el perfil con atención y completa la encuesta en la app como si estuvieras entrevistando a esta persona. No consultes con tus compañeros ni les preguntes qué respondieron. Cuando termines, avísame."

**Paso 3 — Captura independiente (encuestadores)**

Cada encuestador abre el asistente de forma normal y captura basándose únicamente en la vigneta. No hay límite de tiempo. La captura puede hacerse en cualquier momento del día.

**Paso 4 — Generar los back-checks (investigador)**

Una vez que todos los encuestadores han capturado:

1. Ir a **Registros**
2. Identificar las encuestas de la caja negra (mismo NUI del paciente simulado, fecha del ejercicio)
3. Para cada encuesta adicional (2ª, 3ª, 4ª), pulsar el botón **"Back-check"** y seleccionar la primera encuesta como original
4. El asistente se abre en blanco — el investigador captura las respuestas de la encuesta seleccionada tal como las registró ese encuestador (proceso de enlace, no nueva captura)

> **Alternativa más directa:** si las encuestas del ejercicio se crearon consecutivamente y son identificables, el investigador puede designar cualquiera de ellas como "original" y hacer back-check de las demás.

**Paso 5 — Analizar en el panel**

Panel analítico → tarjeta **"Concordancia de back-check"**:

- **κ de Cohen por ítem Sí/No**: acuerdo inter-encuestador corregido por azar
- **% de acuerdo categórico**: proporción de respuestas idénticas entre pares
- **Δ peso (MAD)**: desviación absoluta mediana en la variable peso (si aplica)

Adicionalmente, el investigador coteja cada captura contra las respuestas esperadas del Anexo A para calcular **exactitud individual** (% de ítems correctos por encuestador).

### 3.4 Interpretación y umbrales

| Métrica | Aceptable | Requiere revisión | Crítico |
|---|---|---|---|
| κ promedio (entre encuestadores) | ≥ 0.60 | 0.40 – 0.59 | < 0.40 |
| Exactitud individual (vs. vigneta) | ≥ 85 % | 70 – 84 % | < 70 % |
| % acuerdo categórico | ≥ 80 % | 65 – 79 % | < 65 % |

**Interpretación de κ:**
- κ < 0.40 en un ítem → la pregunta es ambigua; revisar redacción o las opciones de respuesta antes de continuar el piloto
- κ 0.40–0.59 → revisión recomendada; puede reflejar dificultad genuina del concepto
- κ ≥ 0.60 → acuerdo sustancial; la pregunta funciona bien

**Exactitud baja en un encuestador específico (sin que los demás fallen)** → problema de comprensión individual; considerar sesión de entrenamiento focalizada.

**Exactitud baja en todos los encuestadores en el mismo ítem** → la vigneta era ambigua o la pregunta tiene un problema estructural; revisar ambas.

### 3.5 Registro de resultados

Completar la columna "Caja negra" de la [Tabla de Observaciones del Piloto (Anexo B)](#anexo-b--tabla-de-observaciones-del-piloto) con los ítems que no alcanzaron el umbral y la hipótesis de causa.

---

## 4. Back-checks de campo (10 % de la muestra)

### 4.1 Propósito

Los back-checks de campo detectan **fabricación de datos** (*curbstoning*) y miden la **fiabilidad test-retest** del cuestionario sobre hogares reales. A diferencia de la caja negra, aquí el acuerdo esperado no es perfecto — un hogar puede cambiar en el intervalo — pero las divergencias sistemáticas de un encuestador son señal de alerta.

### 4.2 Selección de la submuestra

Durante el piloto, el supervisor (investigador o encuestador designado) selecciona manualmente las encuestas a re-entrevistar. Criterios de elegibilidad:
- Encuesta con estado `synced` (confirmada en servidor)
- No es ya un back-check (no tiene `backcheck_of` asignado)
- Hogar localizable (accesible por videollamada o presencialmente)

Meta: ≥ 10 % del total de encuestas completadas; mínimo 3 back-checks para que el κ sea calculable.

### 4.3 Procedimiento

1. **Registros** → localizar la encuesta a re-entrevistar
2. Pulsar **"Back-check"** en la tarjeta de la encuesta
3. El asistente se abre en **blanco** — el supervisor NO ve las respuestas originales
4. Contactar al hogar (videollamada, llamada o visita) y aplicar el cuestionario completo
5. Guardar → la encuesta queda enlazada al original con `backcheck_of`

> El diseño ciego es intencional: si el supervisor viera las respuestas originales antes de capturar, tendería a reproducirlas (*anchoring bias*), subestimando la discordancia real.

### 4.4 Análisis

Panel analítico → tarjeta **"Concordancia de back-check"**:

- **κ por ítem** y **κ agregado por encuestador**: el encuestador con κ consistentemente bajo es candidato a auditoría
- **Δ peso (MAD)**: diferencia de peso medida en dos momentos; tolerable hasta ±2 kg en piloto
- **% acuerdo categórico**: para ítems nominales sin orden

Usar los mismos umbrales de la §3.4.

---

## 5. Análisis de variabilidad inter-encuestador

### 5.1 Herramientas disponibles en el panel

El panel analítico expone tres vistas complementarias para el investigador:

#### Tarjeta "Control de calidad por encuestador"
Muestra por cada NUI de encuestador:

| Indicador | Señal de alerta | Interpretación |
|---|---|---|
| **Duración mediana** (segundos) | < percentil 10 del grupo | Entrevistas "demasiado rápidas" → posible invención |
| **Entrevistas rápidas** (%) | > 20 % del total | Patrón sistemático de prisa |
| **Straightlining** | Proporción alta de respuestas iguales en bloque | Falta de atención o respuestas por defecto |
| **Preferencia de dígito terminal** (peso) | χ² p < 0.05 | Tendencia a redondear o inventar valores de peso |
| **Completitud** (%) | < 95 % | Ítems obligatorios omitidos |

#### Tarjeta "Control de calidad por encuestador — efecto encuestador"
Evalúa si las prevalencias observadas difieren significativamente entre encuestadores mediante:
- **ICC uno-vía (ANOVA)** sobre ítems binarios: ρ > 0.05 indica que el encuestador explica más varianza de la esperada
- **Nota de agrupamiento**: los intervalos de confianza de los estadísticos agrupan encuestas por encuestador; esta dependencia se declara explícitamente en los informes

#### Panel analítico general
Permite comparar distribuciones de cualquier variable entre encuestadores usando los filtros disponibles. Útil para detectar encuestadores que tienen prevalencias atípicas en variables clave.

### 5.2 Flujo de revisión recomendado

```
Cada semana durante el piloto:
  1. Abrir panel → tarjeta QC encuestador
  2. Identificar encuestadores con ≥ 1 señal de alerta
  3. Para cada encuestador flagueado:
     a. Revisar sus encuestas en "Registros"
     b. Si hay patrón claro → conversación directa + back-check aleatorio de sus encuestas
     c. Si κ del back-check < 0.40 → encuestas marcadas para revisión; no incluir en análisis final
  4. Documentar hallazgos en Anexo B
```

### 5.3 Exportar datos para análisis externo

El CSV descargable desde el panel (botón **Exportar CSV**) incluye las columnas:

| Columna | Contenido |
|---|---|
| `startedAt` | Timestamp de apertura del asistente |
| `createdAt` | Timestamp de guardado |
| `duracion_s` | Duración en segundos (`createdAt − startedAt`) |
| `dataEnv` | `'pilot'` o `'prod'` |
| `nuiEtr` | NUI del encuestador |

Este CSV puede cargarse en R o Python para análisis de varianza entre encuestadores, curvas de aprendizaje (duración vs. número de encuesta) o modelos mixtos con encuestador como efecto aleatorio.

---

## 6. Refinamiento de preguntas

### 6.1 Fuentes de evidencia

Un ítem candidato a reformulación puede identificarse desde cuatro fuentes:

| Fuente | Señal | Cómo acceder |
|---|---|---|
| Caja negra | κ < 0.60 o exactitud < 85 % | Tarjeta "Concordancia de back-check" |
| Back-checks de campo | κ < 0.60 sistemático en el mismo ítem | Tarjeta "Concordancia de back-check" |
| Reporte de encuestadores | Comentario verbal/escrito de dificultad | Sesiones de retroalimentación semanales |
| Tasa de omisión | Ítem frecuentemente en blanco o "No sé" | Panel analítico → distribuciones |

### 6.2 Proceso de revisión

**Semana 1–2 del piloto:**
- Correr caja negra inicial (§3)
- Recoger observaciones de encuestadores al final de cada semana
- Registrar en [Anexo B](#anexo-b--tabla-de-observaciones-del-piloto)

**Al cierre de la primera semana:**
- Investigador consolida la tabla de observaciones
- Clasifica cada ítem problemático: *ambigüedad de redacción* / *opciones de respuesta incompletas* / *salto lógico incorrecto* / *concepto difícil de operacionalizar*
- Propone versión revisada de cada ítem (columna "Versión propuesta" del Anexo B)

**Semana 3 (si el piloto lo permite):**
- Distribuir versión 2 de la vigneta con los ítems reformulados
- Repetir caja negra solo sobre los ítems modificados
- Si κ ≥ 0.60 → ítem aprobado; si persiste < 0.60 → segunda revisión o consulta con el grupo

### 6.3 Qué NO cambiar durante el piloto

- Preguntas con κ ≥ 0.60 en la caja negra (aunque parezcan "mejorables")
- El orden de los pasos del asistente (rompe la comparabilidad entre encuestas del piloto)
- Las opciones de respuesta de ítems que ya tienen datos capturados (invalida las respuestas previas)

Cualquier cambio estructural al cuestionario **reinicia el conteo de encuestas válidas** para ese ítem.

---

## 7. Criterios de salida del piloto (go-live checklist)

Antes de activar el modo producción, verificar que se cumplen **todos** los criterios:

### 7.1 Calidad del instrumento

- [ ] κ promedio en caja negra ≥ 0.60
- [ ] Ningún ítem individual con κ < 0.40
- [ ] Exactitud individual de todos los encuestadores ≥ 85 % en la vigneta
- [ ] Ítems reformulados re-testeados y aprobados (κ ≥ 0.60 en segunda caja negra)

### 7.2 Calidad de los datos del piloto

- [ ] ≥ 30 encuestas piloto completadas con `syncStatus = 'synced'`
- [ ] ≥ 10 % de back-checks ejecutados (mínimo 3)
- [ ] κ agregado de back-checks de campo ≥ 0.60
- [ ] 0 encuestas con datos de sincronización corrompidos

### 7.3 Calidad por encuestador

- [ ] Todos los encuestadores con ≥ 5 encuestas completadas
- [ ] Ningún encuestador con > 20 % de entrevistas "demasiado rápidas"
- [ ] Preferencia de dígito terminal: ningún encuestador con p < 0.01 en χ²
- [ ] ICC uno-vía < 0.10 en ítems clave (el encuestador no domina la varianza)

### 7.4 Técnico — cutover a producción

- [ ] Migración `011_data_env_rls_cutover.sql` aplicada en Supabase (aísla piloto de prod a nivel de RLS)
- [ ] Cuentas productivas promovidas a `data_env = 'prod'` por el administrador
- [ ] Encuestas piloto confirmadas como no visibles en el panel productivo
- [ ] CSV de backup del dataset piloto exportado y almacenado en lugar seguro

> **Nota:** La migración 011 no está aplicada durante el piloto (las cuentas actuales son de tipo `'pilot'` por defecto). Aplicarla en el cutover es el último paso antes del go-live.

---

## 8. Anexos

### Anexo A — Vigneta estándar del caso simulado

La vigneta debe completarse para cada ronda de caja negra. Usar el siguiente formato:

---

**VIGNETA DE CAJA NEGRA — [fecha] — Versión [N]**
*Documento privado del investigador — no distribuir la columna "Respuesta esperada"*

**Perfil sociodemográfico**

| Campo | Valor para el encuestador | Respuesta esperada (investigador) |
|---|---|---|
| Nombre ficticio | Paciente Simulado 01 | — |
| Edad | 58 años | `fNac` = calcular desde edad |
| Ciudad | Bogotá | `ciudad` = Bogotá |
| Estrato | 3 | `estrato` = 3 |
| Fecha de la encuesta | Hoy | `fEta` = fecha actual |

**Condición de salud**

| Campo | Descripción para el encuestador | Respuesta esperada |
|---|---|---|
| Afiliación al sistema de salud | "Estoy afiliado al régimen contributivo" | `asSalud` = Contributivo |
| ¿Tiene médico de cabecera? | "Sí, la doctora Torres en la EPS" | `medSob` = Sí |
| ¿Vigencia del médico al corriente? | "Sí, está activo" | `vtoMedNc` = Sí |

**Medicamentos** *(completar con 2–4 medicamentos reales con nombre genérico, dosis, vencimiento)*

| # | Nombre | Dosis | Fecha vencimiento | Respuesta esperada |
|---|---|---|---|---|
| 1 | Metformina | 850 mg c/12h | 2027-03-15 | `cantMed` ≥ 1; ítem específico |
| 2 | Losartán | 50 mg c/24h | 2026-09-01 | — |
| … | … | … | … | — |

**Notas para el investigador**
- Este perfil activa el salto lógico de `vtoMedNc` → debe aparecer la pregunta de medicamentos vencidos
- `cantMedVto` esperado: 1 (el Losartán vence en < 6 meses desde la fecha de la encuesta)

---

### Anexo B — Tabla de observaciones del piloto

Mantener una copia en el canal del equipo (Google Sheets, Notion, etc.) y actualizar tras cada sesión de retroalimentación o ronda de caja negra.

| # | Ítem / pregunta | Fuente de detección | Problema observado | κ / exactitud | Versión propuesta | Estado | Fecha cierre |
|---|---|---|---|---|---|---|---|
| 1 | | Caja negra · Back-check · Reporte · Omisión | | | | Pendiente / En revisión / Aprobado | |
| 2 | | | | | | | |

**Estados posibles:** `Pendiente` → `En revisión` → `Aprobado` (κ ≥ 0.60 en re-test) o `Descartado` (cambio no viable).

---

### Anexo C — Glosario de métricas

| Término | Definición operacional en MEDD-App |
|---|---|
| **κ de Cohen** | Acuerdo inter-observador sobre ítems categóricos nominales (Sí/No), corregido por acuerdo esperado por azar. Rango −1 a 1; ≥ 0.60 = acuerdo sustancial. |
| **ICC uno-vía** | Coeficiente de correlación intraclase (modelo ANOVA de un factor, efectos aleatorios). Mide qué proporción de la varianza total se explica por el encuestador. ICC > 0.10 en ítems clave sugiere efecto encuestador relevante. |
| **Straightlining** | Patrón de respuesta donde el encuestador selecciona la misma opción para todas las preguntas de un bloque, independientemente del contenido. Señal de baja atención o fatiga. |
| **Preferencia de dígito terminal** | Tendencia a reportar valores numéricos (ej. peso) que terminan en 0 o 5. Se detecta con χ² comparando la distribución observada de los dígitos 0–9 vs. distribución uniforme esperada. |
| **Exactitud individual** | Proporción de ítems capturados correctamente respecto a las respuestas esperadas de la vigneta. Métrica complementaria al κ: aplica solo cuando hay un "estándar de oro" conocido. |
| **Back-check** | Re-entrevista de control aplicada por un supervisor al mismo hogar que fue encuestado originalmente. La captura es ciega (el supervisor no ve las respuestas originales). Detecta fabricación y mide fiabilidad test-retest. |
| **Curbstoning** | Fabricación de datos: el encuestador inventa respuestas sin contactar al hogar. Las señales indirectas incluyen duración extremadamente baja, straightlining y baja concordancia en back-checks. |
| **data_env** | Campo interno de la app que discrimina encuestas del piloto (`'pilot'`) de las productivas (`'prod'`). Asignado por el servidor en el momento de la sincronización; inmutable desde la app. |
| **Duración (duracion_s)** | Diferencia en segundos entre `startedAt` (apertura del asistente) y `createdAt` (guardado). Proxy de atención: duración muy baja puede indicar respuestas sin entrevistar; duración muy alta puede indicar encuesta abandonada y retomada. |
| **AAPOR** | American Association for Public Opinion Research. Sus fórmulas de tasa de respuesta (RR1–RR6) son el estándar para reportar no-respuesta en encuestas probabilísticas. La tasa de no-respuesta no es calculable desde la app (registra solo encuestas completadas, no contactos/rechazos). |
