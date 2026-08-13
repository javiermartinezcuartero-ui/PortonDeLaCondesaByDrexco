import type { Metadata } from "next"
import Link from "next/link"
import { requireSettingsAccess } from "../guards"
import { MAX_RULE_POINTS, listScoringRules } from "@/lib/domain/scoring"
import { PRIVACY_POLICY_VERSION } from "@/lib/legal"
import { ScoringRuleForm } from "../crm-forms"
import { SectionTitle, secondaryButtonClass } from "../crm-ui"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Configuración",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

export default async function SettingsPage() {
  // ADMIN. El apartado ya está oculto para el resto en la navegación, pero eso es
  // interfaz: la autorización real es esta línea.
  await requireSettingsAccess()

  const rules = await listScoringRules()

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-3xl font-light text-foreground">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">Solo administración. Cada cambio queda auditado.</p>
      </div>

      <section aria-labelledby="scoring">
        <SectionTitle hint={`Puntos por hito, de 0 a ${MAX_RULE_POINTS}. Desactivar una regla la excluye del cálculo sin perder su configuración.`}>
          <span id="scoring">Puntuación de contactos</span>
        </SectionTitle>

        <div className="max-w-3xl">
          {rules.map((rule) => (
            <ScoringRuleForm
              key={rule.key}
              ruleKey={rule.key}
              label={rule.label}
              initialPoints={rule.points}
              initialActive={rule.active}
            />
          ))}
        </div>

        <div className="mt-4 max-w-3xl space-y-2 text-xs text-muted-foreground">
          <p>
            La puntuación de cada contacto se <strong className="text-foreground">recalcula desde su historial</strong>, no
            se acumula sumando. Eso hace que el mismo hito no pueda contar dos veces —consultar la misma ficha tres veces
            no triplica nada— y que un cambio de pesos se refleje en cada contacto en su siguiente movimiento.
          </p>
          <p>
            Cambiar un peso no recalcula al instante toda la base: recorrer miles de contactos dentro de una petición web
            sería peor que la ligera desactualización que esto deja. Cada ficha tiene un botón para recalcular al momento.
          </p>
        </div>
      </section>

      <section aria-labelledby="usuarios">
        <SectionTitle>
          <span id="usuarios">Usuarios internos</span>
        </SectionTitle>
        <p className="mb-3 max-w-2xl text-sm text-muted-foreground">
          Lista del equipo y cambio de perfil. El registro público está desactivado y el alta todavía no tiene
          pantalla: las cuentas se crean con
          <code className="mx-1 font-mono text-xs">npm run admin:bootstrap</code>—que crea un ADMIN— y el perfil se
          ajusta después aquí.
        </p>
        <Link href="/admin/usuarios" className={secondaryButtonClass}>
          Gestionar usuarios
        </Link>
      </section>

      <section aria-labelledby="privacidad">
        <SectionTitle>
          <span id="privacidad">Privacidad</span>
        </SectionTitle>
        <dl className="max-w-2xl space-y-2 text-sm">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Versión vigente de la política
            </dt>
            <dd className="font-mono text-foreground">{PRIVACY_POLICY_VERSION}</dd>
          </div>
        </dl>
        <p className="mt-3 max-w-2xl text-xs text-muted-foreground">
          Cada consentimiento se guarda con la versión que la persona aceptó. Al cambiar el texto de la política hay que
          subir esta versión en <code className="font-mono">lib/legal.ts</code>: un consentimiento dado sobre un texto
          anterior no dice nada del nuevo.
        </p>
      </section>
    </div>
  )
}
