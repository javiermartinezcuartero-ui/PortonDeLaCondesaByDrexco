import nextConfig from "eslint-config-next"

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "public/**",
      "project-reference/**",
      "coverage/**",
      // Artefactos generados por Playwright/Vitest al correr las suites, no código
      // fuente. Sin este ignore, eslint los recorre como si fueran propios: son
      // HTML/JS minificados y ahí es donde salían los "186 problems" de la Fase 21,
      // en una línea y columna que no correspondían a ningún archivo del proyecto.
      "playwright-report/**",
      "test-results/**",
      "e2e/.results/**",
    ],
  },
  ...nextConfig,
]

export default eslintConfig
