import { z } from "zod"

/**
 * Validación del formulario de acceso a las bibliotecas VIP. Se aplica **en
 * servidor** dentro del Server Action: la validación del navegador es una
 * ayuda de usabilidad, no una garantía.
 */

const optionalShortText = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((value) => (value ? value : undefined))

export const vipGateSchema = z.object({
  email: z.string().trim().min(1).max(320).email(),

  /** Obligatorio: sin base legal no se guarda nada ni se concede acceso. */
  privacyConsent: z.literal(true),

  /** Separado del anterior, opcional y desmarcado por defecto. */
  marketingConsent: z.boolean().default(false),

  /**
   * Honeypot: un campo oculto que una persona nunca rellena. Si llega con
   * contenido, la petición viene de un bot. Debe estar vacío.
   */
  honeypot: z
    .string()
    .max(0, "Campo reservado")
    .optional()
    .transform(() => undefined),

  /** Categoría de entrada: desde qué biblioteca se pidió el acceso. */
  section: z.enum(["REAL_WEDDING", "CATERING_EVENT"]),

  /** Ruta desde la que se pidió el acceso, para poder volver a ella. */
  returnPath: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((value) => (value ? value : undefined))
    // Solo rutas internas: este valor termina en una redirección.
    .refine(
      (value) => value === undefined || (value.startsWith("/") && !value.startsWith("//")),
      "La ruta de retorno debe ser interna"
    ),

  attribution: z
    .object({
      utmSource: optionalShortText,
      utmMedium: optionalShortText,
      utmCampaign: optionalShortText,
      utmContent: optionalShortText,
      utmTerm: optionalShortText,
      landingPath: optionalShortText,
      referrer: optionalShortText,
    })
    .optional(),
})

export type VipGateValues = z.infer<typeof vipGateSchema>
