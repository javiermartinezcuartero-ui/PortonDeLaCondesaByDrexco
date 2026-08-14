"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Loader2 } from "lucide-react"
import { enterAdminArea } from "./gate-action"

/**
 * Un único campo: la clave. Enter envía, igual que el botón.
 *
 * No hay campo de usuario, ni «recordar», ni recuperación de contraseña, ni
 * enlace de ayuda: no existe nada que recuperar cuando la clave es una sola y
 * está en la configuración del despliegue.
 */
export function GateForm() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // Un envío en vacío no llega al servidor: gastaría uno de los cinco intentos
    // del rate limit sin haber intentado nada.
    if (pending || password.length === 0) return

    setError(null)
    setPending(true)

    const result = await enterAdminArea(password)

    if (result.ok) {
      // `refresh()` además de `push()`: el layout del panel es un componente de
      // servidor y sin refrescar seguiría renderizado con la sesión anterior.
      router.push("/admin")
      router.refresh()
      return
    }

    setPending(false)
    setPassword("")

    if (result.code === "rate-limited") {
      const minutes = Math.ceil((result.retryAfterSeconds ?? 600) / 60)
      setError(`Demasiados intentos. Vuelve a probar en ${minutes} min.`)
      return
    }

    if (result.code === "not-configured") {
      setError("El acceso no está configurado en este despliegue.")
      return
    }

    setError("Contraseña incorrecta.")
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl border border-white/25 bg-white/10 px-4 py-1 backdrop-blur-md transition-colors duration-300 focus-within:border-white/60 focus-within:bg-white/20">
        <KeyRound className="h-5 w-5 shrink-0 text-white/70" aria-hidden />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
          autoFocus
          autoComplete="current-password"
          aria-label="Contraseña de acceso"
          aria-invalid={Boolean(error)}
          placeholder="Contraseña"
          className="w-full border-0 bg-transparent py-3 text-base text-white placeholder:text-white/50 focus:outline-none disabled:opacity-60"
        />
      </div>

      {error && (
        <p role="alert" className="text-center text-sm font-medium text-rose-100 drop-shadow">
          {error}
        </p>
      )}

      <button
        type="submit"
        // El botón no se deshabilita con el campo vacío: en la pantalla real
        // aparecía apagado al 50 % antes de escribir nada, y un botón traslúcido
        // sobre vidrio se lee como roto, no como inactivo. El envío en vacío se
        // ignora arriba.
        disabled={pending}
        aria-busy={pending}
        className="mx-auto flex items-center justify-center gap-2 rounded-full bg-sky-500 px-10 py-3 text-sm font-semibold uppercase tracking-[0.15em] text-white shadow-lg shadow-sky-900/40 transition-all duration-300 hover:bg-sky-400 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  )
}
