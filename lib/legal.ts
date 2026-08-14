/**
 * Versión vigente de la política de privacidad. Se guarda en cada
 * `ConsentEvent` para saber **qué texto exacto** aceptó cada persona.
 *
 * Súbela cada vez que cambie el contenido de `app/politica-privacidad/page.tsx`:
 * un consentimiento otorgado sobre una versión anterior no dice nada sobre la
 * nueva, y esa trazabilidad es justo lo que exige el RGPD.
 */
/*
 * `2026-08.2`: se sube porque cambió el encargado del tratamiento que envía los
 * correos. La versión anterior nombraba a SendGrid y decía que el envío estaba
 * desactivado y que ningún dato salía hacia el proveedor; con Resend en marcha eso ya
 * no es cierto, y un consentimiento otorgado sobre aquel texto no cubre este.
 *
 * Efecto conocido y buscado: quien tenga el formulario abierto desde antes recibirá
 * `policy-version-mismatch` y tendrá que recargar. Es preferible a registrar un
 * consentimiento que apunta a un texto que ya no existe.
 */
export const PRIVACY_POLICY_VERSION = "2026-08.2"

export const PRIVACY_POLICY_PATH = "/politica-privacidad"
