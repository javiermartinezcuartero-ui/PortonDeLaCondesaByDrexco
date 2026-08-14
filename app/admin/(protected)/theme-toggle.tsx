"use client"

import { useState } from "react"
import { Moon, Sun } from "lucide-react"
import { ADMIN_THEME_COOKIE, ADMIN_THEME_COOKIE_PATH, type AdminTheme } from "@/lib/admin-theme"

/**
 * Conmutador día / noche del panel.
 *
 * **Solo el icono**, sin palabra, a petición del titular. El icono indica a dónde se va,
 * no dónde se está: en modo noche se ve un sol. Es la convención de cualquier interruptor
 * de tema.
 *
 * Quitar el texto visible no quita el nombre accesible: sigue en `aria-label`, y el
 * `title` da el mismo texto como sugerencia al pasar el ratón. Un botón con un icono y
 * nada más **es** un fallo de accesibilidad si se queda sin nombre, y es el error más
 * habitual al pedir "solo iconos".
 *
 * El cambio se aplica escribiendo el atributo `data-tema` en el contenedor del
 * panel, fuera de React. Suena raro y es deliberado: ese contenedor lo pinta el
 * layout, que es un componente de servidor, y convertirlo en cliente solo para
 * mover un atributo arrastraría todo el panel al bundle. La cookie que se escribe
 * a la vez mantiene servidor y DOM de acuerdo: cuando el layout vuelva a
 * renderizarse, leerá esa cookie y pintará el mismo valor que ya está puesto.
 */
export function ThemeToggle({ initial }: { initial: AdminTheme }) {
  const [tema, setTema] = useState<AdminTheme>(initial)
  const siguiente: AdminTheme = tema === "noche" ? "dia" : "noche"
  const etiqueta = siguiente === "dia" ? "Día" : "Noche"

  const cambiar = () => {
    const shell = document.querySelector<HTMLElement>(".admin-shell")
    if (shell) {
      shell.dataset.tema = siguiente
    }

    // `secure` solo cuando la conexión lo es: en el servidor de desarrollo (http)
    // el navegador descartaría la cookie sin decir nada y el modo no se
    // recordaría al navegar.
    const secure = window.location.protocol === "https:" ? "; secure" : ""
    document.cookie = `${ADMIN_THEME_COOKIE}=${siguiente}; path=${ADMIN_THEME_COOKIE_PATH}; samesite=lax${secure}`

    setTema(siguiente)
  }

  return (
    <button
      type="button"
      onClick={cambiar}
      aria-label={`Cambiar a modo ${etiqueta.toLowerCase()}`}
      title={`Cambiar a modo ${etiqueta.toLowerCase()}`}
      // Cuadrado de 36 px: el objetivo mínimo cómodo para un icono solo. Con el relleno
      // horizontal anterior (px-4) y sin texto, el botón quedaba ovalado y descentrado.
      className="admin-pill inline-flex size-9 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
    >
      {tema === "noche" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  )
}
