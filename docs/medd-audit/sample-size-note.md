# MEDD — Nota de método: tamaño muestral de la siguiente ola (Sec. 7 Rec. 6)

> Documento de método (no es código de app). Objetivo: calcular el `n` objetivo
> de la próxima ola a partir de la prevalencia observada en el piloto y la
> precisión deseada, **corrigiendo por el efecto de diseño** que el piloto
> detectó (agrupamiento por hogar y por encuestador, ICC≈0,27). El export ya
> deja los insumos limpios: versión de instrumento, `hogar_id` (clúster de
> hogar) y `encuestadorCluster` (clúster de encuestador) identificables, y
> denominadores sin mezclar versiones.

## 1. Parámetros del piloto

| Símbolo | Significado | Valor (piloto) |
|---|---|---|
| `p` | Prevalencia de medicamentos sobrantes (`medSob`='Sí') | ≈ 0,79 |
| `ICC` (ρ) | Correlación intraclase (agrupamiento hogar/encuestador) | ≈ 0,27 |
| `m` | Tamaño medio de clúster (encuestas por clúster) | a fijar en el diseño |

## 2. Fórmula base (muestreo aleatorio simple, MAS)

Para estimar una proporción con nivel de confianza 95 % (`z`=1,96) y **margen de
error absoluto** `d`:

```
n0 = z² · p · (1 − p) / d²
```

Con `p`=0,79 y `z`=1,96:

| Precisión `d` | `n0` (MAS, sin corrección) |
|---|---|
| ± 0,05 (5 pp) | 1,96² · 0,79 · 0,21 / 0,05² ≈ **255** |
| ± 0,04 (4 pp) | ≈ **398** |
| ± 0,03 (3 pp) | ≈ **708** |

> Nota: `p·(1−p)` se maximiza en `p`=0,5. Como `p`≈0,79 está lejos de 0,5, el `n`
> para *esta* proporción es menor que el del peor caso. Si la próxima ola tiene
> **otro** desenlace primario con prevalencia cercana a 0,5 (p. ej. «conoce
> puntos de recolección»), usar `p`=0,5 para ese cálculo (conservador).

## 3. Corrección por efecto de diseño (muestreo por conglomerados)

El piloto **no** es MAS: hay agrupamiento. El efecto de diseño (DEFF) infla la
varianza:

```
DEFF = 1 + (m − 1) · ICC
n_diseño = n0 · DEFF
```

Con `ICC`=0,27, para varios tamaños de clúster `m`:

| `m` (encuestas/clúster) | DEFF = 1 + (m−1)·0,27 | `n` para `d`=±0,05 (n0≈255) |
|---|---|---|
| 2 | 1,27 | ≈ **324** |
| 3 | 1,54 | ≈ **393** |
| 5 | 2,08 | ≈ **530** |
| 8 | 2,89 | ≈ **737** |

**Lectura:** cuantas más encuestas por hogar/encuestador (mayor `m`), mayor el
DEFF y mayor el `n` necesario para la misma precisión. Conviene **más clústeres
con menos encuestas cada uno** que pocos clústeres grandes.

## 4. Ajustes finales

1. **No respuesta / pérdidas.** Inflar por la tasa esperada `r`:
   `n_final = n_diseño / (1 − r)`. Con `r`=0,15 → dividir entre 0,85.
2. **Población finita (FPC).** Si el marco `N` es acotado:
   `n_aj = n / (1 + (n−1)/N)`.
3. **Subgrupos.** Si se requiere estimar por estrato/municipio, dimensionar por
   el subgrupo más pequeño de interés, no solo el total.

### Ejemplo integrado

Desenlace `medSob` (p=0,79), precisión ±5 pp, `m`=3 (DEFF=1,54), no respuesta 15 %:

```
n0        = 255
n_diseño  = 255 · 1,54 ≈ 393
n_final   = 393 / 0,85 ≈ 462  →  ~462 encuestas, repartidas en ≈154 clústeres de 3
```

## 5. Cómo el export habilita este cálculo

- **`instrumentVersion`** (obligatorio, no nulo): permite fijar denominadores por
  versión sin mezclar el defecto del piloto.
- **`hogar_id`** y **`nuiEtr`/`encuestadorCluster`**: identifican los clústeres
  para **estimar `ICC` y `m` reales** en cada ola (recalcular DEFF con datos, no
  con el 0,27 del piloto) — p. ej. con un modelo de intercepto aleatorio por
  hogar/encuestador.
- **Catálogos cerrados** (`ciudad`/`departamento` DANE, disposición, motivos):
  denominadores limpios por subgrupo.

## 6. Recomendación operativa

1. Fijar el **desenlace primario** de la próxima ola y su `p` esperado (usar el
   del piloto o 0,5 si es nuevo/cercano a 0,5).
2. Elegir `d` (precisión) y `m` (encuestas por clúster) según logística.
3. `n_final = [z²·p·(1−p)/d²] · [1+(m−1)·ICC] / (1−r)`.
4. Tras la ola, **re-estimar `ICC` y `m`** desde `hogar_id`/`encuestadorCluster`
   y re-dimensionar la siguiente. (DMAIC → Control.)
