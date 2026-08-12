/**
 * Versión vigente de la política de privacidad. Se guarda en cada
 * `ConsentEvent` para saber **qué texto exacto** aceptó cada persona.
 *
 * Súbela cada vez que cambie el contenido de `app/politica-privacidad/page.tsx`:
 * un consentimiento otorgado sobre una versión anterior no dice nada sobre la
 * nueva, y esa trazabilidad es justo lo que exige el RGPD.
 */
export const PRIVACY_POLICY_VERSION = "2026-08"

export const PRIVACY_POLICY_PATH = "/politica-privacidad"
