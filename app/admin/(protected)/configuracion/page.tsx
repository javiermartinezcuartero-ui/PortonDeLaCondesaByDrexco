import type { Metadata } from "next"
import { requireSettingsAccess } from "../guards"
import { MAX_RULE_POINTS, listScoringRules } from "@/lib/domain/scoring"
import { SCORING_GROUPS } from "@/lib/crm/labels"
import { PRIVACY_POLICY_VERSION } from "@/lib/legal"
import { ScoringTable, type ScoringGroup } from "./scoring-table"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Puntuación Visitantes",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

/**
 * Puntuación Visitantes (antes «Configuración»).
 *
 * Dos cambios de estructura pedidos por el titular, y los dos tienen el mismo motivo:
 *
 * - **La tabla va arriba.** Antes la pantalla abría con un encabezado, un párrafo de ayuda
 *   de tres líneas y otro título de sección; la tabla, que es para lo que se entra, empezaba
 *   por debajo del primer pantallazo. Ahora el encabezado es una línea y lo siguiente es la
 *   tabla. Las explicaciones largas —cómo se recalcula, por qué un cambio de peso no recorre
 *   la base entera— no se han borrado: están **debajo**, que es donde se leen una vez y no
 *   cada día.
 * - **El bloque de usuarios internos ya no se muestra.** Era un párrafo explicando que las
 *   cuentas se crean por consola y un botón «Gestionar usuarios». La ruta /admin/usuarios
 *   sigue existiendo y sigue exigiendo ADMIN: lo que se retira es el cartel, no el permiso.
 *   Esconder un enlace nunca ha sido la protección aquí (ver docs/crm.md §2).
 */
export default async function SettingsPage() {
  // ADMIN. El apartado ya está oculto para el resto en la navegación, pero eso es
  // interfaz: la autorización real es esta línea.
  await requireSettingsAccess()

  const rules = await listScoringRules()
  const porClave = new Map(rules.map((rule) => [rule.key, rule]))

  const groups: ScoringGroup[] = SCORING_GROUPS.map((group) => ({
    title: group.title,
    hint: group.hint,
    rows: group.keys
      .map((key) => porClave.get(key))
      .filter((rule): rule is NonNullable<typeof rule> => rule !== undefined)
      .map((rule) => ({ key: rule.key, label: rule.label, points: rule.points, active: rule.active })),
  })).filter((group) => group.rows.length > 0)

  // Cualquier regla de la base de datos que no esté clasificada arriba. Se muestra en vez de
  // ignorarse: una regla invisible que suma puntos es peor que un grupo llamado «Otros».
  const clasificadas = new Set(SCORING_GROUPS.flatMap((group) => group.keys))
  const sinClasificar = rules.filter((rule) => !clasificadas.has(rule.key))
  if (sinClasificar.length > 0) {
    groups.push({
      title: "Otros hitos",
      hint: "Reglas presentes en la base de datos sin grupo asignado",
      rows: sinClasificar.map((rule) => ({
        key: rule.key,
        label: rule.label,
        points: rule.points,
        active: rule.active,
      })),
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl font-light text-foreground">Puntuación Visitantes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuántos puntos vale cada cosa que hace un visitante, de 0 a {MAX_RULE_POINTS} por hito. Se edita en la
          tabla y cada cambio queda auditado.
        </p>
      </div>

      <ScoringTable groups={groups} maxPoints={MAX_RULE_POINTS} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section aria-labelledby="como-funciona" className="border border-border p-5">
          <h2 id="como-funciona" className="text-sm font-semibold text-foreground">
            Cómo se aplica
          </h2>
          <div className="mt-2 space-y-2 text-xs text-muted-foreground">
            <p>
              La puntuación de cada persona se <strong className="text-foreground">recalcula desde su historial</strong>,
              no se acumula sumando. Eso hace que el mismo hito no pueda contar dos veces —consultar la misma ficha tres
              veces no triplica nada— y que un cambio de pesos se refleje en cada persona en su siguiente movimiento.
            </p>
            <p>
              Cambiar un peso no recalcula al instante toda la base: recorrer miles de registros dentro de una petición
              web sería peor que la ligera desactualización que esto deja. Cada ficha tiene un botón para recalcular al
              momento.
            </p>
            <p>
              Desactivar una regla la excluye del cálculo <strong className="text-foreground">sin perder su peso</strong>,
              para poder volver a activarla tal como estaba.
            </p>
          </div>
        </section>

        <section aria-labelledby="privacidad" className="border border-border p-5">
          <h2 id="privacidad" className="text-sm font-semibold text-foreground">
            Privacidad
          </h2>
          <dl className="mt-2 text-sm">
            <dt className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              Versión vigente de la política
            </dt>
            <dd className="font-mono text-foreground">{PRIVACY_POLICY_VERSION}</dd>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            Cada consentimiento se guarda con la versión que la persona aceptó. Al cambiar el texto de la política hay
            que subir esta versión en <code className="font-mono">lib/legal.ts</code>: un consentimiento dado sobre un
            texto anterior no dice nada del nuevo.
          </p>
        </section>
      </div>
    </div>
  )
}
