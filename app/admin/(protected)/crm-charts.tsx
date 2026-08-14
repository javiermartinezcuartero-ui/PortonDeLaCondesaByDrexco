import type { ReactNode } from "react"
import { EmptyState } from "./crm-ui"

/**
 * Gráficas del panel: anillo, barras y embudo.
 *
 * **Están escritas a mano, en SVG y HTML, y no con una librería de gráficas.** El
 * proyecto trae `recharts` desde la plantilla inicial, así que usarla no habría añadido
 * una dependencia; se descarta por tres motivos concretos:
 *
 * 1. `recharts` solo funciona en el cliente. Las siete pantallas del panel son
 *    componentes de servidor, así que cada gráfica exigiría una frontera de cliente y
 *    viajar los datos ya calculados al navegador para volver a pintarlos allí.
 * 2. Los colores habría que **pasarlos como props**. El panel tiene modo día y noche
 *    resueltos enteramente con variables CSS (ver app/globals.css), y una gráfica que
 *    recibe `#3b82f6` por props es un segundo sitio donde vive la paleta: al cambiar el
 *    tema, la gráfica se queda con el color del otro. Aquí el SVG usa `var(--tono)` y
 *    cambia con el tema sin saber que existe.
 * 3. Peso. Son porcentajes y recuentos, no series temporales interactivas.
 *
 * **Accesibilidad.** El dibujo va con `aria-hidden`: un anillo no se puede leer. El dato
 * lo lleva siempre la leyenda, que es texto real con su cifra y su porcentaje. Así quien
 * usa lector de pantalla no recibe "gráfico" y nada más, sino la tabla de valores.
 */

/** Tonos disponibles. Los colores los define `[data-tono]` en app/globals.css. */
export type Tono = "gris" | "azul" | "cian" | "ambar" | "naranja" | "verde" | "violeta" | "rojo"

export type Segmento = {
  label: string
  value: number
  tono: Tono
  /** Enlace al listado filtrado por este segmento, si lo hay. */
  href?: string
}

/** Tonos por defecto para series sin significado propio (orígenes, fichas…). */
const SERIE: Tono[] = ["azul", "cian", "verde", "ambar", "violeta", "naranja", "gris", "rojo"]

export function tonoDeSerie(index: number): Tono {
  return SERIE[index % SERIE.length]
}

// ---------------------------------------------------------------------------
// Anillo (gráfica circular)
// ---------------------------------------------------------------------------

const RADIO = 42
const GROSOR = 15
const PERIMETRO = 2 * Math.PI * RADIO

/**
 * Gráfica circular de anillo.
 *
 * Es un anillo y no un queso completo porque el hueco central es donde va el total, que
 * es el dato que se busca primero. El truco de dibujo es un `stroke-dasharray` por
 * segmento —un trazo del largo que le toca y un hueco del resto del perímetro— desplazado
 * con `stroke-dashoffset`: un solo círculo por segmento, sin calcular arcos a mano.
 */
export function DonutChart({
  segments,
  totalLabel,
  emptyMessage,
}: {
  segments: Segmento[]
  /** Palabra del centro: "solicitudes", "accesos"… */
  totalLabel: string
  emptyMessage: string
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  if (total === 0) return <EmptyState>{emptyMessage}</EmptyState>

  // Los segmentos vacíos se descartan antes de calcular: un arco de largo 0 no dibuja nada
  // pero sí ocuparía una entrada con `strokeDasharray` degenerado.
  //
  // El desplazamiento de cada arco se calcula sumando los anteriores en cada paso, en vez de
  // llevar un acumulador que se va reasignando. Es O(n²) sobre ocho segmentos como máximo, y
  // a cambio la función no muta nada durante el render, que es lo que el compilador de React
  // exige para poder memoizar este componente.
  const visibles = segments.filter((segment) => segment.value > 0)
  const arcos = visibles.map((segment, index) => {
    const anteriores = visibles.slice(0, index).reduce((sum, previo) => sum + previo.value, 0)
    return {
      ...segment,
      largo: (segment.value / total) * PERIMETRO,
      desplazamiento: -(anteriores / total) * PERIMETRO,
    }
  })

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 100 100" className="h-40 w-40 shrink-0 -rotate-90" aria-hidden="true">
        {/* Pista de fondo: cierra el anillo cuando un segmento es diminuto y deja ver
            que el círculo está completo. */}
        <circle cx="50" cy="50" r={RADIO} fill="none" strokeWidth={GROSOR} className="stroke-secondary" />
        {arcos.map((arco) => (
          <circle
            key={arco.label}
            cx="50"
            cy="50"
            r={RADIO}
            fill="none"
            strokeWidth={GROSOR}
            // `butt` y no `round`: con extremos redondeados, dos segmentos contiguos se
            // solapan y el más pequeño desaparece bajo el siguiente.
            strokeLinecap="butt"
            stroke="var(--tono)"
            data-tono={arco.tono}
            strokeDasharray={`${arco.largo} ${PERIMETRO - arco.largo}`}
            strokeDashoffset={arco.desplazamiento}
          />
        ))}
      </svg>

      <div className="min-w-[180px] flex-1">
        <p className="mb-3">
          <span className="font-serif text-3xl text-foreground">{total}</span>
          <span className="ml-2 text-xs text-muted-foreground">{totalLabel}</span>
        </p>
        <Leyenda segments={segments} total={total} />
      </div>
    </div>
  )
}

function Leyenda({ segments, total }: { segments: Segmento[]; total: number }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {segments.map((segment) => {
        const porcentaje = Math.round((segment.value / total) * 100)
        const contenido = (
          <>
            <span
              aria-hidden="true"
              data-tono={segment.tono}
              className="size-2.5 shrink-0 rounded-full bg-[var(--tono)]"
            />
            <span className="flex-1 truncate text-muted-foreground">{segment.label}</span>
            <span className="font-serif text-foreground">{segment.value}</span>
            <span className="w-10 text-right text-xs text-muted-foreground">{porcentaje} %</span>
          </>
        )

        return (
          <li key={segment.label}>
            {segment.href ? (
              <a
                href={segment.href}
                className="flex items-center gap-2 rounded-md px-1 py-0.5 transition-colors duration-200 hover:bg-[var(--admin-hover)]"
              >
                {contenido}
              </a>
            ) : (
              <span className="flex items-center gap-2 px-1 py-0.5">{contenido}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Barras
// ---------------------------------------------------------------------------

/**
 * Barras horizontales.
 *
 * Horizontales y no verticales porque lo que etiqueta cada barra es texto de largo
 * variable —"instagram · cpc · bodas-primavera", el título de una ficha—: en vertical
 * habría que girarlo o recortarlo.
 *
 * El ancho se mide contra el valor mayor de la serie, no contra la suma, porque estas
 * series no siempre son una partición: comparar cuál destaca es la pregunta, no qué
 * porción del total representa.
 */
export function BarChart({
  rows,
  emptyMessage,
  unit,
}: {
  rows: Array<{ label: string; value: number; tono?: Tono; href?: string; hint?: string }>
  emptyMessage: string
  unit?: string
}) {
  if (rows.length === 0) return <EmptyState>{emptyMessage}</EmptyState>

  const maximo = Math.max(...rows.map((row) => row.value), 1)

  return (
    <ul className="space-y-2.5">
      {rows.map((row, index) => (
        <li key={`${row.label}-${index}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            {row.href ? (
              <a href={row.href} className="truncate text-muted-foreground transition-colors duration-200 hover:text-foreground">
                {row.label}
              </a>
            ) : (
              <span className="truncate text-muted-foreground">{row.label}</span>
            )}
            <span className="shrink-0 font-serif text-foreground">
              {row.value}
              {unit ? <span className="ml-1 text-xs text-muted-foreground">{unit}</span> : null}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              data-tono={row.tono ?? tonoDeSerie(index)}
              className="h-2 rounded-full bg-[var(--tono)] transition-[width] duration-500"
              style={{ width: `${Math.max(2, Math.round((row.value / maximo) * 100))}%` }}
            />
          </div>
          {row.hint && <p className="mt-0.5 text-xs text-muted-foreground">{row.hint}</p>}
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Embudo
// ---------------------------------------------------------------------------

/**
 * Embudo. Cada escalón se mide contra el primero, que es lo que hace que un embudo
 * signifique algo: la caída entre pasos es el dato.
 */
export function FunnelChart({
  steps,
  emptyMessage,
}: {
  steps: Array<{ label: string; value: number }>
  emptyMessage: string
}) {
  const base = steps[0]?.value ?? 0
  if (base === 0) return <EmptyState>{emptyMessage}</EmptyState>

  const tonos: Tono[] = ["azul", "cian", "verde"]

  return (
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const porcentaje = Math.round((step.value / base) * 100)
        const anterior = index === 0 ? null : steps[index - 1]?.value ?? null
        const caida = anterior && anterior > 0 ? Math.round((1 - step.value / anterior) * 100) : null

        return (
          <li key={step.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{step.label}</span>
              <span className="shrink-0">
                <span className="font-serif text-foreground">{step.value}</span>
                <span className="ml-2 text-xs text-muted-foreground">{porcentaje} %</span>
              </span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-secondary">
              <div
                data-tono={tonos[index % tonos.length]}
                className="h-2.5 rounded-full bg-[var(--tono)]"
                style={{ width: `${Math.max(2, porcentaje)}%` }}
              />
            </div>
            {caida !== null && caida > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">Se pierde el {caida} % del paso anterior</p>
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ---------------------------------------------------------------------------
// Tarjeta con gráfica dentro
// ---------------------------------------------------------------------------

/**
 * Envoltorio de una gráfica: título, ayuda y la superficie de tarjeta.
 *
 * Lleva la clase `border`, que es el asidero con el que app/globals.css convierte
 * cualquier caja del panel en una tarjeta de vidrio con su elevación. Así una gráfica
 * nueva no tiene que repetir fondo, radio ni sombra.
 */
export function ChartCard({
  title,
  hint,
  children,
  className = "",
}: {
  title: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`border border-border p-5 ${className}`}>
      <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
      {hint && <p className="mt-1 mb-3 text-xs text-muted-foreground">{hint}</p>}
      <div className={hint ? "" : "mt-3.5"}>{children}</div>
    </section>
  )
}
