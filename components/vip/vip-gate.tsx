"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ContentType } from "@prisma/client"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { useLocale } from "@/lib/i18n"
import { PRIVACY_POLICY_PATH, PRIVACY_POLICY_VERSION } from "@/lib/legal"
import { getAttribution } from "@/lib/attribution"
import { submitVipGateAction, type VipGateErrorCode } from "@/lib/vip/gate-action"

const copy = {
  es: {
    bodas: {
      label: "Bodas reales",
      title: "Accede a la biblioteca de bodas reales",
    },
    catering: {
      label: "Catering",
      title: "Accede a la biblioteca de eventos de catering",
    },
    intro:
      "Déjanos tu email una sola vez y tendrás acceso completo a las dos bibliotecas: bodas reales y eventos de catering.",
    emailLabel: "Email",
    emailPlaceholder: "tu@email.com",
    privacyPrefix: "He leído y acepto la",
    privacyLink: "política de privacidad",
    privacySuffix: "*",
    marketingLabel: "Quiero recibir novedades y comunicaciones comerciales (opcional)",
    submit: "Acceder",
    submitting: "Accediendo…",
    note: "Solo te pediremos el email esta vez. No enviamos nada que no hayas aceptado.",
    errors: {
      "invalid-email": "Introduce un email válido.",
      "privacy-required": "Debes aceptar la política de privacidad para continuar.",
      "rate-limited": "Demasiados intentos. Vuelve a probar en unos minutos.",
      "persistence-failed": "No hemos podido registrar tu acceso. Inténtalo de nuevo en un momento.",
      "invalid-request": "No hemos podido procesar la solicitud. Revisa los datos e inténtalo de nuevo.",
      "policy-version-mismatch":
        "La política de privacidad se ha actualizado. Recarga la página para leerla antes de continuar.",
    } satisfies Record<VipGateErrorCode, string>,
  },
  en: {
    bodas: {
      label: "Real weddings",
      title: "Access the real weddings library",
    },
    catering: {
      label: "Catering",
      title: "Access the catering events library",
    },
    intro:
      "Leave us your email once and you'll get full access to both libraries: real weddings and catering events.",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    privacyPrefix: "I have read and accept the",
    privacyLink: "privacy policy",
    privacySuffix: "*",
    marketingLabel: "I'd like to receive news and marketing communications (optional)",
    submit: "Get access",
    submitting: "Signing in…",
    note: "We'll only ask for your email this once. We won't send anything you haven't agreed to.",
    errors: {
      "invalid-email": "Please enter a valid email address.",
      "privacy-required": "You must accept the privacy policy to continue.",
      "rate-limited": "Too many attempts. Please try again in a few minutes.",
      "persistence-failed": "We couldn't register your access. Please try again in a moment.",
      "invalid-request": "We couldn't process the request. Please check the details and try again.",
      "policy-version-mismatch":
        "The privacy policy has been updated. Please reload the page to read it before continuing.",
    } satisfies Record<VipGateErrorCode, string>,
  },
} as const

/**
 * Formulario de acceso a las bibliotecas VIP.
 *
 * Diferencias deliberadas con el gate provisional que sustituye:
 * - No recibe ni renderiza el contenido protegido: cuando este componente se
 *   muestra, el servidor **no ha consultado** ninguna ficha. No hay children
 *   desenfocados ni contenido en el HTML/payload RSC.
 * - No se puede cerrar ni saltar: no es un diálogo, es la página.
 * - La autorización no vive en `localStorage`, sino en una cookie `HttpOnly`
 *   respaldada por `VipAccessSession` en base de datos.
 */
export function VipGate({ section, returnPath }: { section: ContentType; returnPath: string }) {
  const { locale } = useLocale()
  const t = copy[locale]
  const kind = section === "REAL_WEDDING" ? "bodas" : "catering"
  const sectionCopy = t[kind]

  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // El email escrito se conserva tras un error: es estado del formulario y no
  // se limpia en ningún camino de error.
  const [email, setEmail] = useState("")
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [honeypot, setHoneypot] = useState("")
  const [errorCode, setErrorCode] = useState<VipGateErrorCode | null>(null)

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setErrorCode(null)

    startTransition(async () => {
      const attribution = getAttribution()
      const result = await submitVipGateAction({
        email,
        privacyConsent,
        marketingConsent,
        // La versión que se le ha mostrado, no la que tenga el servidor al
        // procesar: si cambió mientras la página estaba abierta, el servidor lo
        // detecta y pide recargar en vez de registrar un consentimiento sobre un
        // texto que nadie vio.
        policyVersion: PRIVACY_POLICY_VERSION,
        honeypot,
        section,
        returnPath,
        attribution: {
          utmSource: attribution.utmSource ?? undefined,
          utmMedium: attribution.utmMedium ?? undefined,
          utmCampaign: attribution.utmCampaign ?? undefined,
          utmContent: attribution.utmContent ?? undefined,
          landingPath: returnPath,
          referrer: attribution.referrer ?? undefined,
        },
      })

      if (!result.ok) {
        setErrorCode(result.code)
        return
      }

      // La cookie ya está puesta: al refrescar, el servidor resuelve la sesión
      // y renderiza el contenido en vez del gate.
      router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 flex items-center gap-4">
        <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">{sectionCopy.label}</span>
        <div className="h-px w-8 bg-border" />
      </div>

      <h1 className="font-serif text-3xl md:text-4xl font-light text-foreground">{sectionCopy.title}</h1>
      <p className="mt-4 text-muted-foreground leading-relaxed">{t.intro}</p>

      <form onSubmit={onSubmit} noValidate className="mt-10 space-y-6">
        <div className="space-y-1.5">
          <label htmlFor="vip-email" className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
            {t.emailLabel}
          </label>
          <Input
            id="vip-email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder={t.emailPlaceholder}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={errorCode === "invalid-email"}
            aria-describedby={errorCode ? "vip-gate-error" : undefined}
          />
        </div>

        {/* Honeypot: oculto para personas, visible para bots. `aria-hidden` y
            `tabIndex={-1}` lo mantienen fuera del recorrido con teclado y de
            los lectores de pantalla. */}
        <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="vip-website">Website</label>
          <input
            id="vip-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </div>

        <div className="space-y-3">
          <label className="flex items-start gap-3 text-sm text-foreground/80">
            <Checkbox
              checked={privacyConsent}
              onCheckedChange={(checked) => setPrivacyConsent(checked === true)}
              aria-describedby={errorCode === "privacy-required" ? "vip-gate-error" : undefined}
            />
            <span>
              {t.privacyPrefix}{" "}
              <Link href={PRIVACY_POLICY_PATH} className="underline hover:text-foreground transition-colors duration-300">
                {t.privacyLink}
              </Link>{" "}
              {t.privacySuffix}
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm text-foreground/80">
            <Checkbox
              checked={marketingConsent}
              onCheckedChange={(checked) => setMarketingConsent(checked === true)}
            />
            <span>{t.marketingLabel}</span>
          </label>
        </div>

        {errorCode && (
          <p id="vip-gate-error" role="alert" className="text-sm text-destructive">
            {t.errors[errorCode]}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="w-full px-6 py-3.5 text-sm tracking-[0.1em] uppercase text-primary-foreground bg-primary hover:bg-primary/90 transition-colors duration-300 disabled:opacity-60"
        >
          {isPending ? t.submitting : t.submit}
        </button>

        <p className="text-xs text-muted-foreground leading-relaxed">{t.note}</p>
      </form>
    </div>
  )
}
