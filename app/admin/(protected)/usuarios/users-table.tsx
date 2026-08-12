"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateUserRoleAction } from "./actions"

export type UserRow = {
  id: string
  name: string
  email: string
  role: string
}

export function UsersTable({ users }: { users: UserRow[] }) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleRoleChange = (userId: string, role: string) => {
    setError(null)
    setPendingId(userId)
    startTransition(async () => {
      try {
        await updateUserRoleAction(userId, role)
        router.refresh()
      } catch {
        setError("No se ha podido actualizar el rol.")
      } finally {
        setPendingId(null)
      }
    })
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-[0.15em] text-muted-foreground">
            <th className="py-2 pr-4">Nombre</th>
            <th className="py-2 pr-4">Email</th>
            <th className="py-2">Rol</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-border/60">
              <td className="py-2 pr-4 text-foreground">{u.name}</td>
              <td className="py-2 pr-4 text-muted-foreground">{u.email}</td>
              <td className="py-2">
                <select
                  value={u.role}
                  disabled={pendingId === u.id}
                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                  className="border border-border bg-transparent px-2 py-1 text-foreground disabled:opacity-60"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="SALES">SALES</option>
                  <option value="CONTENT">CONTENT</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
