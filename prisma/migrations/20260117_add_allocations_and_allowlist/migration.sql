-- CreateTable: BankTransaction for allocation learning
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "rawDescription" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "isDebit" BOOLEAN NOT NULL DEFAULT true,
    "suggestedCategory" TEXT,
    "suggestedConfidence" REAL,
    "confirmedCategory" TEXT,
    "confirmedByUserId" TEXT,
    "feedback" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BankTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BankTransaction_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable: AllocationRule for learned patterns
CREATE TABLE "AllocationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pattern" TEXT NOT NULL,
    "normalizedPattern" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.7,
    "learnedFromCount" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AllocationRule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable: AllowedEmail for dynamic allowlist
CREATE TABLE "AllowedEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "addedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex: BankTransaction indexes
CREATE INDEX "BankTransaction_userId_idx" ON "BankTransaction"("userId");
CREATE INDEX "BankTransaction_confirmedCategory_idx" ON "BankTransaction"("confirmedCategory");
CREATE INDEX "BankTransaction_processed_idx" ON "BankTransaction"("processed");
CREATE INDEX "BankTransaction_date_idx" ON "BankTransaction"("date");

-- CreateIndex: AllocationRule indexes
CREATE INDEX "AllocationRule_normalizedPattern_idx" ON "AllocationRule"("normalizedPattern");
CREATE INDEX "AllocationRule_category_idx" ON "AllocationRule"("category");
CREATE INDEX "AllocationRule_confidence_idx" ON "AllocationRule"("confidence");

-- CreateIndex: AllowedEmail indexes
CREATE UNIQUE INDEX "AllowedEmail_email_key" ON "AllowedEmail"("email");
CREATE INDEX "AllowedEmail_email_idx" ON "AllowedEmail"("email");

-- Seed initial allowed emails (the core Lorenco emails)
INSERT INTO "AllowedEmail" ("id", "email", "role", "addedBy", "createdAt")
VALUES
    ('core_admin_1', 'ruanvlog@lorenco.co.za', 'ADMIN', NULL, CURRENT_TIMESTAMP),
    ('core_admin_2', 'antonjvr@lorenco.co.za', 'ADMIN', NULL, CURRENT_TIMESTAMP),
    ('core_admin_3', 'mj@lorenco.co.za', 'ADMIN', NULL, CURRENT_TIMESTAMP);
