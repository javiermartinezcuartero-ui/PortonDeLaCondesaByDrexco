-- CreateIndex
CREATE INDEX "content_interaction_type_createdAt_idx" ON "content_interaction"("type", "createdAt");

-- CreateIndex
CREATE INDEX "lead_activity_createdAt_idx" ON "lead_activity"("createdAt");

-- CreateIndex
CREATE INDEX "lead_activity_leadRequestId_idx" ON "lead_activity"("leadRequestId");
