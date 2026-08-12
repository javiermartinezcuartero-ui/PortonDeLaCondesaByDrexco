"use client"

import { createAuthClient } from "better-auth/react"

// Sin `baseURL` explícita: el panel de administración es same-origin con la
// app (no hay servidor de auth separado), y el cliente de Better Auth usa el
// origen actual del navegador por defecto.
export const authClient = createAuthClient()

export const { signIn, signOut, useSession } = authClient
