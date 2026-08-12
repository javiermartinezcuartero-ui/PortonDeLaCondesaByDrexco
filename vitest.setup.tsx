import "@testing-library/jest-dom/vitest"
import { afterEach, vi } from "vitest"
import { cleanup } from "@testing-library/react"

// Carga .env para los tests de dominio que hablan con la base de datos real
// de desarrollo. En CI no existe .env (por diseño, sin secretos, ver
// .github/workflows/ci.yml): esos tests se saltan solos si no hay DATABASE_URL.
try {
  process.loadEnvFile()
} catch {
  // sin .env (p. ej. en CI): los tests de dominio que dependen de BD se saltan.
}

afterEach(() => cleanup())

// next/image no funciona en jsdom (usa el optimizador de Next en servidor);
// se sustituye por un <img> plano para poder probar componentes que lo usan.
vi.mock("next/image", () => ({
  default: ({ src, alt, ...rest }: { src: string; alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...rest} />
  ),
}))
