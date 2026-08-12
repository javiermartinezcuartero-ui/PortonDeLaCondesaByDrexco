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
    ],
  },
  ...nextConfig,
]

export default eslintConfig
