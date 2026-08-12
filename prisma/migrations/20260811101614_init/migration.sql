-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SALES', 'CONTENT');

-- CreateEnum
CREATE TYPE "LeadLifecycle" AS ENUM ('ACTIVE', 'UNSUBSCRIBED', 'ANONYMIZED');

-- CreateEnum
CREATE TYPE "LeadRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'VISIT_SCHEDULED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST', 'NURTURING');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('PRIVACY', 'MARKETING');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('FORM_SUBMITTED', 'VIP_ACCESSED', 'DOSSIER_DOWNLOADED', 'EMAIL_SENT', 'EMAIL_OPENED', 'LINK_CLICKED', 'CALL', 'WHATSAPP', 'NOTE', 'STATUS_CHANGED', 'VISIT', 'PROPOSAL');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('REAL_WEDDING', 'CATERING_EVENT');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'EXTERNAL_VIDEO', 'REEL');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('ES', 'EN');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('GATE_GRANTED', 'SECTION_VIEWED', 'CONTENT_VIEWED', 'CTA_CLICKED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CONTENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "lifecycle" "LeadLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "score" INTEGER NOT NULL DEFAULT 0,
    "firstSource" TEXT,
    "lastSource" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "anonymizedAt" TIMESTAMP(3),

    CONSTRAINT "lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_request" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3),
    "guestCount" INTEGER,
    "company" TEXT,
    "jobTitle" TEXT,
    "audiovisualNeeds" TEXT,
    "preferredSpace" TEXT,
    "budgetRange" TEXT,
    "subject" TEXT,
    "message" TEXT,
    "status" "LeadRequestStatus" NOT NULL DEFAULT 'NEW',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "ownerId" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "sourcePage" TEXT,
    "sourceForm" TEXT,
    "sourceContentId" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "lead_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_event" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "leadRequestId" TEXT,
    "contentEntryId" TEXT,
    "actorId" TEXT,
    "type" "ActivityType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_note" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_task" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_up_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_tag" (
    "leadId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_tag_pkey" PRIMARY KEY ("leadId","tagId")
);

-- CreateTable
CREATE TABLE "scoring_rule" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scoring_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_log" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "template" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_entry" (
    "id" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "eventDate" TIMESTAMP(3),
    "season" TEXT,
    "space" TEXT,
    "decor" TEXT,
    "photocall" TEXT,
    "weather" TEXT,
    "restaurantSolutions" TEXT,
    "testimonialQuote" TEXT,
    "testimonialAuthor" TEXT,
    "priceFrom" INTEGER,
    "priceTo" INTEGER,
    "priceCurrency" TEXT,
    "priceNote" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "content_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_translation" (
    "id" TEXT NOT NULL,
    "contentEntryId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_media" (
    "id" TEXT NOT NULL,
    "contentEntryId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "storagePath" TEXT,
    "url" TEXT,
    "alt" TEXT,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isHero" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_provider" (
    "id" TEXT NOT NULL,
    "contentEntryId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mediaId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_menu_section" (
    "id" TEXT NOT NULL,
    "contentEntryId" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "content_menu_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_menu_item" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "content_menu_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_timeline_item" (
    "id" TEXT NOT NULL,
    "contentEntryId" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "moment" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "content_timeline_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_highlight" (
    "id" TEXT NOT NULL,
    "contentEntryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "content_highlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vip_access_session" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "vip_access_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_interaction" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "contentEntryId" TEXT,
    "section" "ContentType" NOT NULL,
    "type" "InteractionType" NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_interaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_emailNormalized_key" ON "lead"("emailNormalized");

-- CreateIndex
CREATE INDEX "lead_lifecycle_idx" ON "lead"("lifecycle");

-- CreateIndex
CREATE INDEX "lead_lastActivityAt_idx" ON "lead"("lastActivityAt");

-- CreateIndex
CREATE INDEX "lead_request_status_ownerId_nextActionAt_idx" ON "lead_request"("status", "ownerId", "nextActionAt");

-- CreateIndex
CREATE INDEX "lead_request_createdAt_idx" ON "lead_request"("createdAt");

-- CreateIndex
CREATE INDEX "lead_request_leadId_idx" ON "lead_request"("leadId");

-- CreateIndex
CREATE INDEX "lead_request_utmSource_utmMedium_utmCampaign_idx" ON "lead_request"("utmSource", "utmMedium", "utmCampaign");

-- CreateIndex
CREATE INDEX "consent_event_leadId_purpose_idx" ON "consent_event"("leadId", "purpose");

-- CreateIndex
CREATE INDEX "lead_activity_leadId_createdAt_idx" ON "lead_activity"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "lead_note_leadId_idx" ON "lead_note"("leadId");

-- CreateIndex
CREATE INDEX "follow_up_task_assigneeId_status_dueAt_idx" ON "follow_up_task"("assigneeId", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "tag_name_key" ON "tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_rule_key_key" ON "scoring_rule"("key");

-- CreateIndex
CREATE INDEX "notification_log_leadId_createdAt_idx" ON "notification_log"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_event_entityType_entityId_idx" ON "audit_event"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_event_createdAt_idx" ON "audit_event"("createdAt");

-- CreateIndex
CREATE INDEX "content_entry_type_status_sortOrder_idx" ON "content_entry"("type", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "content_entry_status_publishedAt_idx" ON "content_entry"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "content_entry_type_slug_key" ON "content_entry"("type", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "content_translation_contentEntryId_locale_key" ON "content_translation"("contentEntryId", "locale");

-- CreateIndex
CREATE INDEX "content_media_contentEntryId_sortOrder_idx" ON "content_media"("contentEntryId", "sortOrder");

-- CreateIndex
CREATE INDEX "content_provider_contentEntryId_sortOrder_idx" ON "content_provider"("contentEntryId", "sortOrder");

-- CreateIndex
CREATE INDEX "content_menu_section_contentEntryId_sortOrder_idx" ON "content_menu_section"("contentEntryId", "sortOrder");

-- CreateIndex
CREATE INDEX "content_menu_item_sectionId_sortOrder_idx" ON "content_menu_item"("sectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "content_timeline_item_contentEntryId_sortOrder_idx" ON "content_timeline_item"("contentEntryId", "sortOrder");

-- CreateIndex
CREATE INDEX "content_highlight_contentEntryId_sortOrder_idx" ON "content_highlight"("contentEntryId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "vip_access_session_tokenHash_key" ON "vip_access_session"("tokenHash");

-- CreateIndex
CREATE INDEX "vip_access_session_leadId_idx" ON "vip_access_session"("leadId");

-- CreateIndex
CREATE INDEX "content_interaction_leadId_createdAt_idx" ON "content_interaction"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "content_interaction_contentEntryId_createdAt_idx" ON "content_interaction"("contentEntryId", "createdAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_request" ADD CONSTRAINT "lead_request_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_request" ADD CONSTRAINT "lead_request_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_event" ADD CONSTRAINT "consent_event_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_leadRequestId_fkey" FOREIGN KEY ("leadRequestId") REFERENCES "lead_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_contentEntryId_fkey" FOREIGN KEY ("contentEntryId") REFERENCES "content_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_note" ADD CONSTRAINT "lead_note_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_note" ADD CONSTRAINT "lead_note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_task" ADD CONSTRAINT "follow_up_task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_task" ADD CONSTRAINT "follow_up_task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tag" ADD CONSTRAINT "lead_tag_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_tag" ADD CONSTRAINT "lead_tag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_entry" ADD CONSTRAINT "content_entry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_entry" ADD CONSTRAINT "content_entry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_translation" ADD CONSTRAINT "content_translation_contentEntryId_fkey" FOREIGN KEY ("contentEntryId") REFERENCES "content_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_media" ADD CONSTRAINT "content_media_contentEntryId_fkey" FOREIGN KEY ("contentEntryId") REFERENCES "content_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_provider" ADD CONSTRAINT "content_provider_contentEntryId_fkey" FOREIGN KEY ("contentEntryId") REFERENCES "content_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_provider" ADD CONSTRAINT "content_provider_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "content_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_menu_section" ADD CONSTRAINT "content_menu_section_contentEntryId_fkey" FOREIGN KEY ("contentEntryId") REFERENCES "content_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_menu_item" ADD CONSTRAINT "content_menu_item_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "content_menu_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_timeline_item" ADD CONSTRAINT "content_timeline_item_contentEntryId_fkey" FOREIGN KEY ("contentEntryId") REFERENCES "content_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_highlight" ADD CONSTRAINT "content_highlight_contentEntryId_fkey" FOREIGN KEY ("contentEntryId") REFERENCES "content_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vip_access_session" ADD CONSTRAINT "vip_access_session_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_interaction" ADD CONSTRAINT "content_interaction_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_interaction" ADD CONSTRAINT "content_interaction_contentEntryId_fkey" FOREIGN KEY ("contentEntryId") REFERENCES "content_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
