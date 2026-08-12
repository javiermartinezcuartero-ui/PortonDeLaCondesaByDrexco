import { getSessionUser } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: "Acceso completo: usuarios, exportación, anonimización y configuración.",
  SALES: "CRM, notas y tareas comerciales.",
  CONTENT: "Contenido, media, previsualización y publicación.",
}

export default async function AdminHomePage() {
  const user = await getSessionUser()
  // El layout ya redirige a /admin/login si no hay sesión; esto no debería
  // alcanzarse nunca, pero evita un `user.name` sobre `null` si lo hiciera.
  if (!user) return null

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="font-serif text-3xl font-light text-foreground">Bienvenido, {user.name}</h1>
      <p className="text-muted-foreground">{ROLE_DESCRIPTIONS[user.role]}</p>
    </div>
  )
}
