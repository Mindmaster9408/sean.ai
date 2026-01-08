-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_KnowledgeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "layer" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'GLOBAL',
    "scopeClientId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contentText" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'EN',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "primaryDomain" TEXT NOT NULL DEFAULT 'OTHER',
    "secondaryDomains" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "kbVersion" INTEGER NOT NULL DEFAULT 1,
    "citationId" TEXT NOT NULL,
    "supersededById" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnowledgeItem_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeItem_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_KnowledgeItem" ("approvedAt", "approvedByUserId", "citationId", "contentText", "createdAt", "id", "kbVersion", "language", "layer", "scopeClientId", "scopeType", "slug", "status", "submittedByUserId", "supersededById", "tags", "title", "updatedAt") SELECT "approvedAt", "approvedByUserId", "citationId", "contentText", "createdAt", "id", "kbVersion", "language", "layer", "scopeClientId", "scopeType", "slug", "status", "submittedByUserId", "supersededById", "tags", "title", "updatedAt" FROM "KnowledgeItem";
DROP TABLE "KnowledgeItem";
ALTER TABLE "new_KnowledgeItem" RENAME TO "KnowledgeItem";
CREATE UNIQUE INDEX "KnowledgeItem_citationId_key" ON "KnowledgeItem"("citationId");
CREATE INDEX "KnowledgeItem_status_idx" ON "KnowledgeItem"("status");
CREATE INDEX "KnowledgeItem_layer_idx" ON "KnowledgeItem"("layer");
CREATE INDEX "KnowledgeItem_scopeType_idx" ON "KnowledgeItem"("scopeType");
CREATE INDEX "KnowledgeItem_slug_idx" ON "KnowledgeItem"("slug");
CREATE INDEX "KnowledgeItem_primaryDomain_idx" ON "KnowledgeItem"("primaryDomain");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
