-- Proveedor y destinatarios enmascarados en el registro de avisos, y leadId
-- opcional para los avisos internos de resumen (que no pertenecen a un contacto).

-- AlterTable
ALTER TABLE "notification_log" ALTER COLUMN "leadId" DROP NOT NULL;
ALTER TABLE "notification_log" ADD COLUMN     "provider" TEXT;
ALTER TABLE "notification_log" ADD COLUMN     "recipients" TEXT;

-- CreateIndex
CREATE INDEX "notification_log_template_createdAt_idx" ON "notification_log"("template", "createdAt");

-- Corrección de datos: las filas en PENDING de la fase anterior significaban
-- exactamente "no había proveedor de correo configurado". Ahora ese caso tiene su
-- propio estado, así que se reetiquetan en vez de dejarlas en un limbo que el
-- código ya no produce.
UPDATE "notification_log" SET "status" = 'SKIPPED_CONFIG' WHERE "status" = 'PENDING';
