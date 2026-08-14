"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { logoutAction } from "./logout-action"

export function LogoutButton() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const handleLogout = async () => {
    setIsLoading(true)
    setFailed(false)
    const result = await logoutAction()

    if (!result.ok) {
      // No se navega a ningún sitio si el cierre de sesión no se ha confirmado:
      // llevar al login con la sesión todavía viva es justo el fallo que se corrige.
      setIsLoading(false)
      setFailed(true)
      return
    }

    router.push("/admin/login")
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoading}
        // `h-9` para que quede a la misma altura que el conmutador de tema, que al quedarse
        // solo con el icono pasó a ser un cuadrado de 36 px.
        className="admin-pill admin-pill--danger inline-flex h-9 items-center rounded-full px-5 text-xs font-medium uppercase tracking-[0.12em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)] focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {isLoading ? "Saliendo…" : "Salir"}
      </button>
      {failed && (
        <p role="alert" className="text-[11px] text-destructive">
          No se ha podido cerrar la sesión. Inténtalo de nuevo.
        </p>
      )}
    </div>
  )
}
