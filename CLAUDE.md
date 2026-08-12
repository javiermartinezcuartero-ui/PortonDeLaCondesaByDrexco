# Reglas de trabajo — El Portón de la Condesa

## Fuente de verdad

1. Inspecciona el código antes de editar.
2. Lee README.md y project-reference/ antes de cada fase importante.
3. Amplía este proyecto Next.js; no crees otro proyecto.
4. Conserva el diseño, responsive, tipografías, animaciones y componentes válidos.

## Desarrollo

- Usa npm y package-lock.json salvo evidencia contraria confirmada.
- No mezcles dos ORM, dos sistemas de autenticación ni dos fuentes de contenido.
- Separa UI, validación, dominio y acceso a datos.
- No ocultes errores con ignoreBuildErrors, any, ts-ignore o exclusiones amplias.
- No borres cambios ajenos.
- No hagas commit, push, cambio de visibilidad ni deploy sin petición explícita.

## Seguridad

- No incluyas secretos, contraseñas, tokens, datos personales ni cadenas reales en archivos versionables.
- Valida autorización en servidor para cada lectura o mutación privada.
- El contenido VIP no se consulta, renderiza ni serializa antes de validar una sesión de acceso en servidor.
- El registro administrativo público permanece desactivado.
- Privacidad y marketing son consentimientos separados.

## Documentación obligatoria

En cada fase:

1. Lee el README antes de modificar.
2. Actualiza su estado, arquitectura, funcionalidades, variables, comandos, pruebas, seguridad, decisiones y pendientes según corresponda.
3. Añade una entrada breve al historial de implementación con fecha, fase, cambios y evidencia.
4. No marques como terminado lo que no se haya probado.
5. Los documentos de docs/ amplían el README, pero no sustituyen su resumen técnico completo.

## Cierre de cada fase

- Ejecuta las validaciones afectadas.
- Indica archivos modificados.
- Indica comandos y resultados reales.
- Separa completado, pendiente y bloqueado.
- Detente al final de la fase para revisión.
