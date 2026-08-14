import { Download, FileSpreadsheet } from "lucide-react"

/**
 * Botón de descarga a Excel de un listado del CRM.
 *
 * Solo iconos, sin texto, como se pidió: la hoja de cálculo dice qué se descarga y la
 * flecha, que se descarga. Que no haya texto obliga a dos cosas que no son opcionales:
 *
 * - **`aria-label`**, porque sin él un lector de pantalla anuncia «enlace» y nada más.
 *   Dos iconos decorativos no son un nombre accesible: los dos van con `aria-hidden`
 *   precisamente para que no se lean como «imagen, imagen».
 * - **`title`**, que es lo que ve quien usa el ratón. Un botón sin texto es un
 *   jeroglífico hasta que alguien lo pulsa una vez, y el panel lo usa gente que entra
 *   cada día pero no todos los días.
 *
 * Es un `<a>` y no un `<button>` porque descarga un archivo desde una URL con los
 * filtros en la propia dirección: así funciona con clic derecho, en pestaña nueva y sin
 * JavaScript, y la vista filtrada que se descarga es la misma que se está viendo.
 */
export function ExportButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1.5 border border-border px-3 py-2 text-muted-foreground transition-colors duration-300 hover:text-foreground focus-visible:outline-none focus-visible:border-foreground"
    >
      <FileSpreadsheet className="h-[18px] w-[18px]" aria-hidden />
      <Download className="h-3.5 w-3.5" aria-hidden />
    </a>
  )
}
