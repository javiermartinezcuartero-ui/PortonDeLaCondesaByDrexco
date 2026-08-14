import Link from "next/link"
import type { ReactNode } from "react"
import type { LeadRequestStatus } from "@prisma/client"
import { PIPELINE_TONE, REQUEST_STATUS_LABEL } from "@/lib/crm/labels"
import type { Ratio, Average } from "@/lib/domain/metrics"

/**
 * Piezas de presentación compartidas por las pantallas del CRM. Son componentes
 * de servidor sin estado: aquí no hay lógica de negocio ni consultas, solo la
 * forma de mostrar lo que ya viene calculado.
 */

export function MetricCard({
  label,
  value,
  hint,
  href,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  href?: string
}) {
  const body = (
    <>
      {/* La etiqueta deja de ser un rótulo diminuto en mayúsculas con mucho espaciado.
          En una tarjeta de métrica lo que se lee primero es la cifra, y la etiqueta
          solo tiene que decir de qué es: a 12 px normales se identifica de un vistazo,
          y a 10 px espaciados hay que enfocar la vista para leerla. */}
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {/* La cifra sube de 3xl a 4xl y pierde el peso ligero. `font-serif` se conserva
          aunque en el panel no haya serif: es el asidero con el que app/globals.css le
          pone la monoespaciada de cifras tabulares, que es lo que permite comparar
          varias tarjetas en columna sin que los números bailen. */}
      <span className="mt-2.5 block font-serif text-4xl text-foreground">{value}</span>
      {hint && <span className="mt-1.5 block text-xs leading-snug text-muted-foreground">{hint}</span>}
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        // La tarjeta que enlaza se levanta un píxel al pasar por encima. Es la señal
        // que distingue «esto es un dato» de «esto lleva a algún sitio», sin añadir un
        // icono ni un texto de más.
        className="block border border-border p-5 transition-all duration-200 hover:-translate-y-px hover:border-foreground/40"
      >
        {body}
      </Link>
    )
  }

  return <div className="border border-border p-5">{body}</div>
}

/**
 * Un ratio siempre con su denominador visible. Sin denominador no se pinta un
 * 0 %: se dice que no hay datos, porque un 0 % afirma algo que no sabemos.
 */
export function RatioValue({ ratio, unit = "%" }: { ratio: Ratio; unit?: string }) {
  if (ratio.percentage === null) {
    return <span className="text-muted-foreground">Sin datos</span>
  }
  return (
    <>
      {ratio.percentage}
      {unit}
    </>
  )
}

export function RatioHint({ ratio, noun }: { ratio: Ratio; noun: string }) {
  if (ratio.denominator === 0) return <>Todavía no hay {noun} para calcularlo</>
  return (
    <>
      {ratio.numerator} de {ratio.denominator} {noun}
    </>
  )
}

export function AverageValue({ average, unit }: { average: Average; unit: string }) {
  if (average.value === null) return <span className="text-muted-foreground">Sin datos</span>
  return (
    <>
      {average.value} {unit}
    </>
  )
}

/**
 * Título de un bloque dentro de una pantalla.
 *
 * Era un rótulo de 12 px en mayúsculas y con el espaciado muy abierto, del color del
 * texto secundario: se leía como una etiqueta más, no como el encabezado de una
 * sección. Ahora es un encabezado de verdad —14 px, peso medio, color principal—, que
 * es lo que ordena una pantalla con varios bloques.
 */
export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3.5">
      <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">{children}</h2>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

/**
 * Etiqueta de estado. Cápsula redonda, como los «chips» de cualquier CRM actual.
 *
 * Deja de ser un rectángulo de 10 px en mayúsculas espaciadas: a ese tamaño el
 * espaciado entre letras hace que una palabra corta como «ALTA» se lea peor que
 * escrita normal. Se mantienen las mayúsculas y el cuerpo pequeño —es una marca, no
 * texto para leer— pero con el espaciado justo y una forma que se distingue del dato
 * que tiene al lado.
 */
export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "alert" | "accent" }) {
  const toneClass =
    tone === "alert"
      ? "bg-destructive/12 text-destructive"
      : tone === "accent"
        ? "bg-primary/12 text-primary"
        : "bg-secondary text-muted-foreground"

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[0.02em] ${toneClass}`}>
      {children}
    </span>
  )
}

/**
 * Fase del pipeline, con el color tipo semáforo del tablero.
 *
 * Existe para que la fase se vea igual en las cuatro pantallas que la muestran
 * —tablero, listado de solicitudes, ficha de la solicitud y ficha del contacto—. Antes
 * cada una decidía por su cuenta con un ternario `LOST ? alerta : WON ? acento :
 * neutro`, así que las siete fases intermedias salían todas del mismo gris y el color
 * del tablero no se correspondía con el del listado. El criterio de color está en
 * `PIPELINE_TONE`, en un solo sitio.
 */
export function StatusPill({ status }: { status: LeadRequestStatus }) {
  return (
    <span className="pipe-pill" data-tono={PIPELINE_TONE[status]}>
      {REQUEST_STATUS_LABEL[status]}
    </span>
  )
}

export function Pagination({
  page,
  totalPages,
  total,
  noun,
  buildHref,
}: {
  page: number
  totalPages: number
  total: number
  noun: string
  buildHref: (page: number) => string
}) {
  if (totalPages <= 1) {
    return (
      <p className="text-sm text-muted-foreground">
        {total} {noun}
      </p>
    )
  }

  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">
        Página {page} de {totalPages} ({total} {noun})
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={buildHref(page - 1)} className={paginationButtonClass}>
            Anterior
          </Link>
        )}
        {page < totalPages && (
          <Link href={buildHref(page + 1)} className={paginationButtonClass}>
            Siguiente
          </Link>
        )}
      </div>
    </nav>
  )
}

/**
 * Botones y campos compartidos.
 *
 * Están aquí y no repetidos en cada pantalla porque son la razón de que las nueve
 * vistas del panel se parezcan entre sí: cambiar la forma de un botón en este archivo
 * lo cambia en todas, y es lo que ha permitido modernizar el panel entero sin tocar
 * pantalla por pantalla.
 *
 * El cambio de estilo tiene un criterio, no es gusto: los botones dejan de ser
 * rectángulos de 12 px en mayúsculas con el espaciado muy abierto. Esa fórmula viene
 * del escaparate —donde funciona, porque hay pocos botones y muy separados— y en una
 * herramienta con seis controles en la misma barra convierte cada uno en un cartel.
 * Ahora son cápsulas de texto normal en peso medio: se leen antes y ocupan menos.
 */
const paginationButtonClass =
  "rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"

/**
 * Campo de filtro. Sin radio ni color de fondo escritos aquí: los pone
 * `app/globals.css` para todos los campos del panel a la vez, y una utilidad en esta
 * clase no le ganaría (ver el aviso sobre capas en ese archivo). Lo que sí se define
 * aquí es el espaciado y el tamaño del texto, que no están declarados allí.
 *
 * Las medidas bajan un escalón —de `px-3 py-2 text-sm` a `px-2.5 py-1.5 text-[13px]`—
 * como parte de compactar el bloque de filtros: con once campos en pantalla, dos píxeles
 * de relleno por campo son casi cincuenta de alto total.
 */
export const filterFieldClass =
  "w-full border border-border px-2.5 py-1.5 text-[13px] text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:border-foreground/50"

export const filterLabelClass = "block text-[11px] font-medium text-muted-foreground mb-1"

/**
 * Bloque de filtros plegable.
 *
 * El problema que resuelve: en Interesados y en Solicitudes los filtros son once campos
 * con su etiqueta, y desplegados ocupaban más alto que las primeras filas de datos. Lo
 * primero que se veía al entrar era el formulario para buscar, no lo que hay.
 *
 * Es un `<details>` nativo, no un desplegable con estado en React, y eso importa por tres
 * cosas: funciona sin JavaScript (los filtros de este panel son un formulario GET, así que
 * la pantalla entera funciona sin él), el navegador ya le da el rol y el estado de
 * accesibilidad correctos —`aria-expanded` incluido— y no arrastra ninguna de las dos
 * pantallas al cliente.
 *
 * **Se abre solo si hay algún filtro puesto.** Al revés sería una trampa: alguien llega
 * por un enlace filtrado, ve tres resultados y no encuentra por qué, porque el filtro que
 * los recorta está escondido. El recuento en la cabecera dice cuántos hay activos incluso
 * plegado.
 */
export function FilterPanel({
  activeCount,
  clearHref,
  children,
}: {
  /** Cuántos filtros hay puestos ahora mismo. Decide si el bloque nace abierto. */
  activeCount: number
  clearHref: string
  children: ReactNode
}) {
  return (
    <details open={activeCount > 0} className="crm-filtros border border-border px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground">
        <span aria-hidden="true" className="crm-filtros__flecha text-[10px] leading-none">
          ▶
        </span>
        Filtros
        {activeCount > 0 ? (
          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
            {activeCount}
          </span>
        ) : (
          <span className="text-[11px] font-normal">· ninguno aplicado</span>
        )}
      </summary>
      <form method="get" className="mt-3 space-y-3 border-t border-border/50 pt-3">
        {children}
        <div className="flex gap-2">
          <button type="submit" className={buttonClass}>
            Filtrar
          </button>
          <Link href={clearHref} className={secondaryButtonClass}>
            Limpiar
          </Link>
        </div>
      </form>
    </details>
  )
}

export const buttonClass =
  "rounded-full px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary transition-all duration-200 hover:brightness-110 disabled:opacity-60"

export const secondaryButtonClass =
  "rounded-full px-4 py-2 text-xs font-medium text-muted-foreground border border-border transition-colors duration-200 hover:text-foreground disabled:opacity-60"
