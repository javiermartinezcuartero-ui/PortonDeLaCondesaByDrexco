"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  anonymizeLeadAction,
  revokeMarketingConsentAction,
  revokeVipSessionsAction,
  type PrivacyActionResult,
} from "../../privacy-actions"

/**
 * Operaciones de privacidad de un contacto. Solo se pinta para ADMIN, pero eso es
 * interfaz: cada acción vuelve a exigir el permiso en servidor.
 *
 * La anonimización pide confirmación escrita y no un simple "¿seguro?": es
 * irreversible y afecta a datos de una persona. Un botón con doble clic accidental
 * no debería poder destruir un historial.
 */

const primaryClass =
  "px-4 py-2 text-xs tracking-[0.15em] uppercase text-primary-foreground bg-primary transition-colors duration-300 hover:bg-primary/90 disabled:opacity-60"
const subtleClass =
  "px-3 py-1.5 text-xs tracking-[0.15em] uppercase text-muted-foreground border border-border transition-colors duration-300 hover:text-foreground disabled:opacity-60"
const dangerClass =
  "px-4 py-2 text-xs tracking-[0.15em] uppercase text-destructive border border-destructive/40 transition-colors duration-300 hover:bg-destructive/10 disabled:opacity-60"

const CONFIRMATION = "ANONIMIZAR"

export function PrivacyPanel({
  leadId,
  isAnonymized,
  activeVipSessions,
  hasMarketingConsent,
}: {
  leadId: string
  isAnonymized: boolean
  activeVipSessions: number
  hasMarketingConsent: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState("")

  const run = (action: () => Promise<PrivacyActionResult<unknown>>, success: (data: unknown) => string) => {
    setErrors([])
    setMessage(null)
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        setMessage(success(result.data))
        setConfirmation("")
        router.refresh()
      } else {
        setErrors(result.errors)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {/* Descarga directa: el navegador guarda el archivo, no pasa por el cliente. */}
        <a href={`/api/admin/crm/lead-data?lead=${encodeURIComponent(leadId)}`} className={subtleClass}>
          Descargar sus datos (JSON)
        </a>

        {hasMarketingConsent && (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(() => revokeMarketingConsentAction({ leadId }), () => "Consentimiento de marketing revocado.")
            }
            className={subtleClass}
          >
            Revocar marketing
          </button>
        )}

        {activeVipSessions > 0 && (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(
                () => revokeVipSessionsAction({ leadId }),
                (data) => {
                  const revoked = (data as { revoked: number }).revoked
                  return `${revoked} ${revoked === 1 ? "sesión revocada" : "sesiones revocadas"}.`
                }
              )
            }
            className={subtleClass}
          >
            Revocar acceso VIP ({activeVipSessions})
          </button>
        )}
      </div>

      {!isAnonymized && (
        <div className="border border-destructive/30 p-4">
          <p className="text-sm text-foreground">Anonimizar este contacto</p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Sustituye su email, nombre y teléfono por valores no reversibles, vacía el texto libre de sus solicitudes,
            borra sus notas internas y revoca sus accesos. Se conservan los datos agregables del CRM y la auditoría.{" "}
            <strong className="text-foreground">No se puede deshacer.</strong>
          </p>
          <label htmlFor="confirmar-anonimizar" className="mt-3 block text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Escribe {CONFIRMATION} para confirmar
          </label>
          <input
            id="confirmar-anonimizar"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="mt-1 w-full max-w-xs border border-border bg-transparent px-2.5 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:border-foreground"
            autoComplete="off"
          />
          <div className="mt-3">
            <button
              type="button"
              disabled={isPending || confirmation !== CONFIRMATION}
              onClick={() =>
                run(
                  () => anonymizeLeadAction({ leadId }),
                  (data) => {
                    const notes = (data as { notesDeleted: number }).notesDeleted
                    return `Contacto anonimizado. Notas internas borradas: ${notes}.`
                  }
                )
              }
              className={dangerClass}
            >
              {isPending ? "Anonimizando…" : "Anonimizar definitivamente"}
            </button>
          </div>
        </div>
      )}

      {isAnonymized && (
        <p className="text-sm text-muted-foreground">
          Este contacto está anonimizado. Se conservan sus datos agregables y la auditoría.
        </p>
      )}

      <div aria-live="polite" className="space-y-1 text-sm">
        {message && <p className="text-foreground">{message}</p>}
        {errors.length > 0 && (
          <ul role="alert" className="text-destructive">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
