"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"

const selectClass =
  "border border-border bg-transparent px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

/**
 * Filtros del listado. Escriben en la query string y dejan que el Server
 * Component vuelva a consultar: no hay estado de resultados en el cliente, así
 * la paginación y el filtrado siguen siendo server-side (y la URL es
 * compartible).
 */
export function ContentFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const apply = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    // Cualquier cambio de filtro vuelve a la primera página.
    next.delete("pagina")
    router.push(`/admin/contenidos?${next.toString()}`)
  }

  const onSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = new FormData(event.currentTarget).get("q")
    apply("q", typeof value === "string" ? value.trim() : "")
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSearchSubmit} role="search" className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1 space-y-1.5">
          <label htmlFor="filter-q" className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
            Buscar
          </label>
          <Input
            id="filter-q"
            name="q"
            type="search"
            defaultValue={searchParams.get("q") ?? ""}
            placeholder="Título, slug o espacio"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-xs tracking-[0.15em] uppercase text-primary-foreground bg-primary hover:bg-primary/90 transition-colors duration-300"
        >
          Buscar
        </button>
      </form>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <label htmlFor="filter-tipo" className="block text-xs tracking-[0.2em] uppercase text-muted-foreground">
            Tipo
          </label>
          <select
            id="filter-tipo"
            className={selectClass}
            value={searchParams.get("tipo") ?? ""}
            onChange={(event) => apply("tipo", event.target.value)}
          >
            <option value="">Todos</option>
            <option value="REAL_WEDDING">Bodas reales</option>
            <option value="CATERING_EVENT">Catering</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="filter-estado" className="block text-xs tracking-[0.2em] uppercase text-muted-foreground">
            Estado
          </label>
          <select
            id="filter-estado"
            className={selectClass}
            value={searchParams.get("estado") ?? ""}
            onChange={(event) => apply("estado", event.target.value)}
          >
            <option value="">Todos</option>
            <option value="DRAFT">Borrador</option>
            <option value="PUBLISHED">Publicado</option>
            <option value="ARCHIVED">Archivado</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="filter-demo" className="block text-xs tracking-[0.2em] uppercase text-muted-foreground">
            Ejemplo (demo)
          </label>
          <select
            id="filter-demo"
            className={selectClass}
            value={searchParams.get("demo") ?? ""}
            onChange={(event) => apply("demo", event.target.value)}
          >
            <option value="">Indiferente</option>
            <option value="si">Solo ejemplos</option>
            <option value="no">Solo contenido real</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="filter-destacado" className="block text-xs tracking-[0.2em] uppercase text-muted-foreground">
            Destacado
          </label>
          <select
            id="filter-destacado"
            className={selectClass}
            value={searchParams.get("destacado") ?? ""}
            onChange={(event) => apply("destacado", event.target.value)}
          >
            <option value="">Indiferente</option>
            <option value="si">Solo destacados</option>
            <option value="no">No destacados</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="filter-desde" className="block text-xs tracking-[0.2em] uppercase text-muted-foreground">
            Evento desde
          </label>
          <Input
            id="filter-desde"
            type="date"
            className="w-auto"
            defaultValue={searchParams.get("desde") ?? ""}
            onChange={(event) => apply("desde", event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="filter-hasta" className="block text-xs tracking-[0.2em] uppercase text-muted-foreground">
            Evento hasta
          </label>
          <Input
            id="filter-hasta"
            type="date"
            className="w-auto"
            defaultValue={searchParams.get("hasta") ?? ""}
            onChange={(event) => apply("hasta", event.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
