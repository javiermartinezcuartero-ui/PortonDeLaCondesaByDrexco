-- AlterTable
ALTER TABLE "content_media" ADD COLUMN     "inGallery" BOOLEAN NOT NULL DEFAULT true;

-- Corrección de datos: las filas de media que solo existen para ilustrar a un
-- proveedor no deben aparecer en la galería pública. Antes de esta columna no
-- había forma de distinguirlas, así que las fichas ya sembradas mostraban las
-- imágenes de proveedor duplicadas dentro de la cuadrícula de la galería.
UPDATE "content_media"
SET "inGallery" = false
WHERE "id" IN (
  SELECT "mediaId" FROM "content_provider" WHERE "mediaId" IS NOT NULL
);
