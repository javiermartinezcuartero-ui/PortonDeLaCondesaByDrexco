"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"

export function LogoutButton() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleLogout = async () => {
    setIsLoading(true)
    await authClient.signOut()
    router.push("/admin/login")
    router.refresh()
  }

  return (
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
  )
}
