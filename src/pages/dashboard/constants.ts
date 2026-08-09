import { C } from '../../components/ui'
import { type InsightTone } from '../../lib/insights'

export const STAT_GLOSSARY = {
  lecturaRapida:
    'Síntesis automática (offline, basada en reglas) de los indicadores y pruebas del panel, en lenguaje sencillo. Es una lectura exploratoria de primer vistazo; los números completos están en cada tarjeta y la confirmación estadística se hace en SPSS/Stata/R.',
  prevalencia:
    'Prevalencia: proporción de la muestra con la característica, con su intervalo de confianza al 95% (método de Wilson, fiable con muestras pequeñas o proporciones extremas). El IC marca el rango plausible del valor real: cuanto más estrecho, más preciso.',
  asociacion:
    'Ji-cuadrado (χ²): evalúa si el desenlace difiere entre grupos; p<0,05 sugiere que la diferencia difícilmente sea por azar. RP (razón de prevalencia): cuántas veces más frecuente es el desenlace frente al grupo de referencia (RP=1 = sin diferencia; el IC95% que no cruza 1 indica asociación). Cochran–Armitage añade una prueba de tendencia para una exposición ordenada (p. ej. estrato).',
  icc:
    'ICC (correlación intraclase): qué parte de la variación del desenlace se explica por el agrupamiento (p. ej. encuestas del mismo encuestador). Un ICC alto infla la imprecisión real (efecto de diseño) y puede hacer que los valores p sin ajustar parezcan más fuertes de lo que son.',
  mh:
    'Mantel–Haenszel: estima la asociación ajustando por una variable de confusión (combina los estratos). Si la estimación ajustada cambia >10% frente a la cruda, hay confusión y se reporta la ajustada. Breslow–Day comprueba que el efecto sea homogéneo entre estratos.',
  kappa:
    'κ de Cohen: concordancia entre dos mediciones corregida por el azar. Bandas de Landis–Koch: <0,2 pobre · 0,2–0,4 débil · 0,4–0,6 moderada · 0,6–0,8 buena · >0,8 muy buena. Concordancia baja sugiere variabilidad de medición o, en casos extremos, fabricación.',
  holm:
    'Holm–Bonferroni: cuando se hacen varias pruebas a la vez, ajusta los valores p para controlar la probabilidad de falsos positivos por familia. «Sobrevive» = sigue siendo significativo tras el ajuste; lo que no sobrevive se trata como hipótesis a confirmar.',
  retencion:
    'Resumen de la distribución de días vencido: mediana (valor central), RIC (rango intercuartílico Q1–Q3, la dispersión central) y percentil 90 (la cola). Son medidas robustas, poco sensibles a valores extremos.',
  digit:
    'Prueba de dígito terminal: la última cifra de una medición debería repartirse de forma uniforme (0–9). Un sesgo marcado hacia ciertos dígitos sugiere redondeo sistemático o datos inventados.',
  obsField:
    'Panel de observaciones de campo: lista las anotaciones libres que los encuestadores registraron en el Paso 6 del formulario. Permite buscar por palabra clave y ver el contexto de cada observación junto con los metadatos del registro.',
  discourse:
    'Análisis discursivo: examina el corpus de observaciones como texto. La nube de términos muestra la frecuencia relativa de cada palabra (tamaño proporcional a ocurrencias); el gráfico de barras cuantifica los 15 más frecuentes. Los bigramas (pares de palabras consecutivas) revelan frases-clave que los términos aislados no detectan. Procesado en el cliente, sin API externa — los resultados son orientadores.',
  hermeneutic:
    'Análisis hermenéutico: clasifica las observaciones según un diccionario de categorías temáticas del dominio (acceso, conocimiento del paciente, almacenamiento, calidad del dato, entorno social, señales de alarma). La matriz de co-ocurrencia muestra cuántas encuestas activan dos temas a la vez — pares frecuentes son hipótesis para fases posteriores. La categorización es automática (basada en palabras clave) y debe validarse con lectura manual del corpus.',
} as const

// "Lectura rápida" auto-insights: the rule-based read-out lives in lib/insights
// (a non-component module) so this file stays Fast-Refresh-friendly; here we only
// render it.
export const INSIGHT_TONE: Record<InsightTone, { color: string; icon: string }> = {
  good: { color: C.green, icon: 'ti-circle-check' },
  warn: { color: C.amber, icon: 'ti-alert-triangle' },
  info: { color: C.teal,  icon: 'ti-info-circle' },
}
