import Link from "next/link"
import type { ReactNode } from "react"
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
      <span className="text-xs tracking-[0.15em] uppercase text-muted-foreground">{label}</span>
      <span className="mt-2 block font-serif text-3xl font-light text-foreground">{value}</span>
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="block border border-border p-5 transition-colors duration-300 hover:border-foreground"
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

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{children}</h2>
      {hint && <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p>}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{children}</p>
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "alert" | "accent" }) {
  const toneClass =
    tone === "alert"
      ? "bg-destructive/10 text-destructive"
      : tone === "accent"
        ? "bg-primary/10 text-primary"
        : "bg-secondary text-muted-foreground"

  return <span className={`px-2 py-0.5 text-[10px] tracking-[0.15em] uppercase ${toneClass}`}>{children}</span>
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
          <Link
            href={buildHref(page - 1)}
            className="border border-border px-3 py-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground transition-colors duration-300 hover:text-foreground"
          >
            Anterior
          </Link>
        )}
        {page < totalPages && (
          <Link
            href={buildHref(page + 1)}
            className="border border-border px-3 py-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground transition-colors duration-300 hover:text-foreground"
          >
            Siguiente
          </Link>
        )}
      </div>
    </nav>
  )
}

/** Estilo compartido de los campos de filtro, para que todos los formularios coincidan. */
export const filterFieldClass =
  "w-full border border-border bg-transparent px-2.5 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:border-foreground"

export const filterLabelClass = "block text-[10px] tracking-[0.15em] uppercase text-muted-foreground mb-1"

export const buttonClass =
  "px-4 py-2 text-xs tracking-[0.15em] uppercase text-primary-foreground bg-primary transition-colors duration-300 hover:bg-primary/90 disabled:opacity-60"

export const secondaryButtonClass =
  "px-4 py-2 text-xs tracking-[0.15em] uppercase text-muted-foreground border border-border transition-colors duration-300 hover:text-foreground disabled:opacity-60"
