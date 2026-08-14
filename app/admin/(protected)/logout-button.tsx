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
      className="rounded-full bg-white/10 px-5 py-2 text-xs font-medium uppercase tracking-[0.12em] text-foreground ring-1 ring-white/15 transition-all duration-300 hover:bg-white/20 hover:ring-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-60"
    >
      {isLoading ? "Saliendo…" : "Salir"}
    </button>
  )
}
