-- AlterTable
ALTER TABLE "KnowledgeItem" ADD COLUMN "sourceSection" TEXT;
ALTER TABLE "KnowledgeItem" ADD COLUMN "sourceType" TEXT;
ALTER TABLE "KnowledgeItem" ADD COLUMN "sourceUrl" TEXT;

-- CreateIndex
CREATE INDEX "KnowledgeItem_sourceType_idx" ON "KnowledgeItem"("sourceType");
