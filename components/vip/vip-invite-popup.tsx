"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRight, Check, Mail } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { useLocale } from "@/lib/i18n"
import { PRIVACY_POLICY_PATH, PRIVACY_POLICY_VERSION } from "@/lib/legal"
import { getAttribution } from "@/lib/attribution"
import { submitVipGateAction, type VipGateErrorCode } from "@/lib/vip/gate-action"

/**
 * Segundos que el visitante debe llevar en la página antes de ver el aviso.
 *
 * Baja de 90 a 35 por petición del titular. El plazo cuenta **la visita, no la página**
 * (ver `alreadyScheduledRef`), así que a los 35 segundos el aviso salta aunque se hayan
 * recorrido tres secciones de la home en ese tiempo.
 */
const DELAY_SECONDS = 35

/** Destino del aviso: la biblioteca de bodas reales. */
const LIBRARY_PATH = "/bodas-reales"

/**
 * Marca de «no volver a mostrarlo». Vive en `sessionStorage`, no en `localStorage`:
 * si alguien lo cierra, se le deja en paz durante esa visita, pero no se le marca
 * para siempre. Quien deja el email recibe la cookie de acceso de 30 días y el
 * aviso deja de aparecer por la vía buena —el endpoint dice que ya tiene acceso—,
 * no por esta marca.
 */
const DISMISSED_KEY = "porton_vip_invite_cerrado"

/**
 * Rutas donde el aviso no aparece.
 *
 * Las dos bibliotecas ya tienen su propio formulario a pantalla completa: superponer
 * un diálogo que pide lo mismo sería pedir el email dos veces en la misma pantalla.
 * El panel queda fuera por lo obvio. Y las páginas legales, porque interrumpir la
 * lectura de la política de privacidad con una captación de email es justo lo que no
 * hay que hacer —y porque desde ahí se llega leyendo un enlace del propio aviso—.
 */
const EXCLUDED_PREFIXES = ["/admin", LIBRARY_PATH, "/catering", "/aviso-legal", "/politica-privacidad", "/politica-cookies"]

const copy = {
  es: {
    eyebrow: "Bodas reales",
    title: "Bodas celebradas aquí",
    description: "Biblioteca privada con bodas reales de la finca. Déjanos tu email y entras.",
    emailLabel: "Email",
    emailPlaceholder: "tu@email.com",
    privacyPrefix: "Acepto la",
    privacyLink: "política de privacidad",
    privacySuffix: "*",
    marketingLabel: "Quiero recibir novedades (opcional)",
    submit: "Acceder",
    submitting: "Un momento…",
    note: "El mismo acceso abre la biblioteca de catering.",
    successTitle: "Acceso concedido",
    successBody: "El mismo acceso vale para la biblioteca de catering.",
    successCta: "Entrar en la biblioteca",
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
    eyebrow: "Real weddings",
    title: "Weddings held here",
    description: "A private library of real weddings at the venue. Leave your email and you're in.",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    privacyPrefix: "I accept the",
    privacyLink: "privacy policy",
    privacySuffix: "*",
    marketingLabel: "I'd like to receive news (optional)",
    submit: "Get access",
    submitting: "One moment…",
    note: "The same access opens the catering library.",
    successTitle: "Access granted",
    successBody: "The same access works for the catering library.",
    successCta: "Enter the library",
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
 * Aviso de las bibliotecas VIP: aparece a los 35 segundos, pide el email y, cuando
 * lo recibe, ofrece un botón que entra directamente en la biblioteca.
 *
 * **No es un gate ni lo sustituye.** El contenido protegido sigue estando detrás de
 * `VipGate` y de la validación en servidor; esto solo adelanta el momento de pedir
 * el email a quien está navegando por el sitio público. Usa la misma acción de
 * servidor, así que registra el lead, los dos consentimientos por separado y la
 * atribución exactamente igual, y la sesión que abre vale para las dos bibliotecas
 * —eso ya funcionaba así, no es nuevo—.
 *
 * **El diálogo es de Radix** (`components/ui/dialog.tsx`) y no un `div` con
 * `position: fixed`. Un modal hecho a mano hay que dotarlo de foco atrapado, cierre
 * con Escape, `aria-modal`, retorno del foco al cerrar y bloqueo del scroll de
 * fondo; todo eso viene resuelto, y un aviso que interrumpe es justo donde no
 * conviene improvisar accesibilidad.
 */
export function VipInvitePopup() {
  const { locale } = useLocale()
  const t = copy[locale]
  const pathname = usePathname()

  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState("")
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [honeypot, setHoneypot] = useState("")
  const [errorCode, setErrorCode] = useState<VipGateErrorCode | null>(null)
  const [granted, setGranted] = useState(false)

  // Si ya se mostró en esta carga, no se vuelve a programar al navegar entre
  // secciones de la home: el temporizador cuenta la visita, no la página.
  const alreadyScheduledRef = useRef(false)

  useEffect(() => {
    if (alreadyScheduledRef.current) return
    if (EXCLUDED_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) return
    if (sessionStorage.getItem(DISMISSED_KEY) === "1") return

    alreadyScheduledRef.current = true

    const timer = setTimeout(() => {
      // La comprobación de acceso se hace **al cumplirse el plazo**, no al cargar:
      // así la petición solo sale para quien de verdad va a ver el aviso.
      void fetch("/api/vip/access", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : { hasAccess: true }))
        .then((data: { hasAccess?: boolean }) => {
          // Ante la duda, no se molesta: si la respuesta no trae el dato, se asume
          // que ya tiene acceso y el aviso no aparece.
          if (data.hasAccess === false) setIsOpen(true)
        })
        .catch(() => undefined)
    }, DELAY_SECONDS * 1000)

    return () => clearTimeout(timer)
  }, [pathname])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    // Al cerrar sin haber entregado el email se anota la renuncia. Si ya se
    // concedió el acceso no hace falta: la cookie de sesión ya lo impide.
    if (!open && !granted) {
      sessionStorage.setItem(DISMISSED_KEY, "1")
    }
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setErrorCode(null)

    startTransition(async () => {
      const attribution = getAttribution()
      const result = await submitVipGateAction({
        email,
        privacyConsent,
        marketingConsent,
        policyVersion: PRIVACY_POLICY_VERSION,
        honeypot,
        section: "REAL_WEDDING",
        returnPath: LIBRARY_PATH,
        attribution: {
          utmSource: attribution.utmSource ?? undefined,
          utmMedium: attribution.utmMedium ?? undefined,
          utmCampaign: attribution.utmCampaign ?? undefined,
          utmContent: attribution.utmContent ?? undefined,
          // La página donde se mostró el aviso, no la biblioteca de destino: es el
          // dato que dice desde dónde se captó a esta persona.
          landingPath: pathname ?? "/",
          referrer: attribution.referrer ?? undefined,
        },
      })

      if (!result.ok) {
        setErrorCode(result.code)
        return
      }

      setGranted(true)
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {/* La estética es la de la pantalla de acceso al panel: tarjeta de vidrio,
          esquina grande y una sombra azulada muy difusa. `sm:max-w-md` para que no
          se lea como una página dentro de la página. */}
      {/* `rounded-3xl` explícito: el `DialogContent` de shadcn trae `rounded-lg`, que
          a este tamaño se lee como una caja de sistema y no como la tarjeta de la
          pantalla de acceso. */}
      <DialogContent className="vip-invite gap-0 rounded-3xl border-white/20 bg-[oklch(0.19_0.03_255/90%)] p-0 text-white shadow-[0_40px_90px_-25px_rgba(30,64,175,0.70)] backdrop-blur-2xl sm:max-w-[26rem]">
        <div className="p-7 sm:p-8">
          {granted ? (
            <div className="space-y-5">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[oklch(0.72_0.15_150/25%)]">
                <Check className="h-5 w-5 text-[oklch(0.85_0.16_150)]" aria-hidden />
              </span>
              <DialogTitle className="text-2xl font-semibold tracking-[-0.02em] text-white">
                {t.successTitle}
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-white/70">
                {t.successBody}
              </DialogDescription>
              {/* El botón que pidió el titular: del email a la biblioteca en un
                  clic. Es un `Link` normal —no un `router.push` tras un temporizador—
                  para que quien quiera abrirlo en otra pestaña pueda. */}
              <Link
                href={LIBRARY_PATH}
                onClick={() => setIsOpen(false)}
                className="group inline-flex w-full items-center justify-center gap-3 rounded-xl bg-white px-6 py-3.5 text-sm font-medium uppercase tracking-[0.12em] text-[oklch(0.19_0.03_255)] transition-transform duration-300 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <span>{t.successCta}</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
              </Link>
            </div>
          ) : (
            <>
              {/* Sin icono: el corazón decoraba sin decir nada y competía con el
                  título en un diálogo que tiene que leerse de un vistazo. Queda el
                  rótulo de sección, que sí sitúa. */}
              <span className="text-[11px] uppercase tracking-[0.28em] text-white/55">{t.eyebrow}</span>

              <DialogTitle className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.03em] text-white">
                {t.title}
              </DialogTitle>
              <DialogDescription className="mt-2.5 text-sm leading-relaxed text-white/70">
                {t.description}
              </DialogDescription>

              <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
                {/* Campo de email con el icono dentro y sin etiqueta encima: el
                    marcador de posición y el icono ya dicen qué va aquí, y en un
                    diálogo de un solo campo una etiqueta suelta solo añade altura.
                    El nombre accesible lo da `aria-label`, así que quien use lector
                    de pantalla sigue oyendo «Email». */}
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" aria-hidden />
                  <Input
                    id="vip-invite-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    aria-label={t.emailLabel}
                    placeholder={t.emailPlaceholder}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-invalid={errorCode === "invalid-email"}
                    aria-describedby={errorCode ? "vip-invite-error" : undefined}
                    className="h-14 rounded-2xl border-white/15 bg-white/[0.07] pl-11 pr-4 text-[15px] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] transition-all duration-300 placeholder:text-white/40 hover:bg-white/[0.1] focus-visible:border-white/40 focus-visible:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-white/25"
                  />
                </div>

                {/* Honeypot, igual que en el gate de la biblioteca: invisible para
                    personas, tentador para un bot. */}
                <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
                  <label htmlFor="vip-invite-website">Website</label>
                  <input
                    id="vip-invite-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(event) => setHoneypot(event.target.value)}
                  />
                </div>

                {/* Los dos consentimientos van separados y ninguno viene marcado:
                    aceptar la política de privacidad no es aceptar publicidad.
                    Discretos —casilla de 14 px y texto de 11— porque son la letra
                    pequeña, no la acción; lo que no se toca es su tamaño de
                    pulsación, que lo da la etiqueta entera. */}
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-2.5 py-0.5 text-[11px] leading-snug text-white/60 transition-colors duration-300 hover:text-white/85">
                    <Checkbox
                      checked={privacyConsent}
                      onCheckedChange={(checked) => setPrivacyConsent(checked === true)}
                      aria-describedby={errorCode === "privacy-required" ? "vip-invite-error" : undefined}
                      className="size-3.5 rounded-[5px] border-white/25 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-[oklch(0.19_0.03_255)]"
                    />
                    <span>
                      {t.privacyPrefix}{" "}
                      <Link href={PRIVACY_POLICY_PATH} className="underline underline-offset-2 hover:text-white">
                        {t.privacyLink}
                      </Link>{" "}
                      {t.privacySuffix}
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-center gap-2.5 py-0.5 text-[11px] leading-snug text-white/60 transition-colors duration-300 hover:text-white/85">
                    <Checkbox
                      checked={marketingConsent}
                      onCheckedChange={(checked) => setMarketingConsent(checked === true)}
                      className="size-3.5 rounded-[5px] border-white/25 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-[oklch(0.19_0.03_255)]"
                    />
                    <span>{t.marketingLabel}</span>
                  </label>
                </div>

                {errorCode && (
                  <p id="vip-invite-error" role="alert" className="text-sm text-[oklch(0.78_0.17_25)]">
                    {t.errors[errorCode]}
                  </p>
                )}

                {/* Este botón solo envía el email. El de entrar en la biblioteca
                    aparece después, en la vista de acceso concedido: así el
                    diálogo no promete la puerta antes de tener la llave. */}
                <button
                  type="submit"
                  disabled={isPending}
                  aria-busy={isPending}
                  className="w-full rounded-2xl bg-white px-6 py-3.5 text-sm font-medium uppercase tracking-[0.12em] text-[oklch(0.19_0.03_255)] shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-transform duration-300 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-60"
                >
                  {isPending ? t.submitting : t.submit}
                </button>

                {/* Se retiró el botón «Ahora no» a petición del titular. El
                    diálogo sigue siendo rechazable por tres vías: el aspa de la
                    esquina, la tecla Escape y un clic fuera —las tres las aporta
                    Radix—, así que no queda nadie atrapado dentro. */}
                <p className="text-[11px] leading-relaxed text-white/45">{t.note}</p>
              </form>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
