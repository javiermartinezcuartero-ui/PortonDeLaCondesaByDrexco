-- AlterTable
ALTER TABLE "content_entry" ADD COLUMN     "ctaHref" TEXT,
ADD COLUMN     "ctaLabel" TEXT,
ADD COLUMN     "seoNoindex" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "content_media" ADD COLUMN     "height" INTEGER,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "sizeBytes" INTEGER,
ADD COLUMN     "thumbnailUrl" TEXT,
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "content_translation" ADD COLUMN     "intro" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT;

-- CreateIndex
CREATE INDEX "content_media_storagePath_idx" ON "content_media"("storagePath");
