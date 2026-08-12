import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // El paquete `server-only` lanza siempre salvo que se resuelva con la
      // condición `react-server`, que solo aplica el bundler de Next. En los
      // tests se apunta a su módulo vacío para poder importar los módulos
      // server-only (lib/storage/supabase.ts, lib/domain/content-media.ts).
      // La protección real sigue intacta en el build de Next.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.tsx"],
    css: false,
    // Los tests de dominio hablan con la base de desarrollo de Supabase a
    // través del pooler (ver docs/arquitectura-backend.md §5): un test que
    // encadena varias operaciones supera de largo el timeout por defecto de
    // 5s solo por latencia de red, sin que haya nada mal.
    testTimeout: 30_000,
    exclude: ["node_modules", ".next", "project-reference"],
    coverage: {
      reporter: ["text", "html"],
      exclude: ["node_modules/**", ".next/**", "components/ui/**", "project-reference/**"],
    },
  },
})
