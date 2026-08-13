-- Estados nuevos de NotificationStatus.
--
-- Va en una migración propia a propósito: PostgreSQL no permite **usar** un valor
-- de enum recién añadido dentro de la misma transacción en que se añadió, y la
-- siguiente migración necesita escribir 'SKIPPED_CONFIG' en una corrección de
-- datos. Separarlas es la única forma de que ambas se apliquen sin fallar.

-- AlterEnum
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'SKIPPED_CONFIG';
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'RETRY_PENDING';
