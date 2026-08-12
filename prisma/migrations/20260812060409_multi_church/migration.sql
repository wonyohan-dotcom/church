/*
  Warnings:

  - You are about to drop the `ChurchSetting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `active` on the `User` table. All the data in the column will be lost.
  - Added the required column `churchId` to the `Account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `churchId` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `churchId` to the `Budget` table without a default value. This is not possible if the table is not empty.
  - Added the required column `churchId` to the `District` table without a default value. This is not possible if the table is not empty.
  - Added the required column `churchId` to the `DonationReceipt` table without a default value. This is not possible if the table is not empty.
  - Added the required column `churchId` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `churchId` to the `HistoryEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `churchId` to the `HistoryPhoto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `churchId` to the `Household` table without a default value. This is not possible if the table is not empty.
  - Added the required column `churchId` to the `Member` table without a default value. This is not possible if the table is not empty.
  - Added the required column `churchId` to the `Offering` table without a default value. This is not possible if the table is not empty.
  - Added the required column `churchId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ChurchSetting";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Church" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "regNo" TEXT,
    "representative" TEXT,
    "postalCode" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "logoUrl" TEXT,
    "sealUrl" TEXT,
    "receiptAutoIssue" BOOLEAN NOT NULL DEFAULT true,
    "joinOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "isOffering" BOOLEAN NOT NULL DEFAULT false,
    "deductible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "churchId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Account_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Account" ("active", "category", "code", "createdAt", "deductible", "id", "isOffering", "name", "sortOrder", "type") SELECT "active", "category", "code", "createdAt", "deductible", "id", "isOffering", "name", "sortOrder", "type" FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
CREATE INDEX "Account_churchId_type_idx" ON "Account"("churchId", "type");
CREATE UNIQUE INDEX "Account_churchId_code_key" ON "Account"("churchId", "code");
CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT,
    "churchId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("action", "createdAt", "entity", "entityId", "id", "summary", "userId") SELECT "action", "createdAt", "entity", "entityId", "id", "summary", "userId" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE INDEX "AuditLog_churchId_createdAt_idx" ON "AuditLog"("churchId", "createdAt");
CREATE INDEX "AuditLog_churchId_entity_idx" ON "AuditLog"("churchId", "entity");
CREATE TABLE "new_Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "churchId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    CONSTRAINT "Budget_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Budget_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Budget" ("accountId", "amount", "id", "year") SELECT "accountId", "amount", "id", "year" FROM "Budget";
DROP TABLE "Budget";
ALTER TABLE "new_Budget" RENAME TO "Budget";
CREATE INDEX "Budget_churchId_year_idx" ON "Budget"("churchId", "year");
CREATE UNIQUE INDEX "Budget_year_accountId_key" ON "Budget"("year", "accountId");
CREATE TABLE "new_District" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "leaderName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "churchId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "District_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_District" ("createdAt", "id", "leaderName", "name", "sortOrder") SELECT "createdAt", "id", "leaderName", "name", "sortOrder" FROM "District";
DROP TABLE "District";
ALTER TABLE "new_District" RENAME TO "District";
CREATE UNIQUE INDEX "District_churchId_name_key" ON "District"("churchId", "name");
CREATE TABLE "new_DonationReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNo" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "churchId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "donorName" TEXT NOT NULL,
    "donorRegNoEnc" TEXT,
    "donorAddress" TEXT,
    "donorPhone" TEXT,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedAt" DATETIME,
    "issuedById" TEXT,
    "rejectReason" TEXT,
    "note" TEXT,
    CONSTRAINT "DonationReceipt_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DonationReceipt_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DonationReceipt_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DonationReceipt" ("donorAddress", "donorName", "donorPhone", "donorRegNoEnc", "id", "issuedAt", "issuedById", "memberId", "note", "receiptNo", "rejectReason", "requestedAt", "status", "totalAmount", "year") SELECT "donorAddress", "donorName", "donorPhone", "donorRegNoEnc", "id", "issuedAt", "issuedById", "memberId", "note", "receiptNo", "rejectReason", "requestedAt", "status", "totalAmount", "year" FROM "DonationReceipt";
DROP TABLE "DonationReceipt";
ALTER TABLE "new_DonationReceipt" RENAME TO "DonationReceipt";
CREATE INDEX "DonationReceipt_churchId_status_idx" ON "DonationReceipt"("churchId", "status");
CREATE INDEX "DonationReceipt_churchId_year_idx" ON "DonationReceipt"("churchId", "year");
CREATE UNIQUE INDEX "DonationReceipt_memberId_year_key" ON "DonationReceipt"("memberId", "year");
CREATE UNIQUE INDEX "DonationReceipt_churchId_receiptNo_key" ON "DonationReceipt"("churchId", "receiptNo");
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "churchId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "payee" TEXT,
    "method" TEXT NOT NULL DEFAULT 'TRANSFER',
    "description" TEXT,
    "receiptUrl" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Expense_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Expense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("accountId", "amount", "createdAt", "createdById", "date", "description", "id", "method", "note", "payee", "receiptUrl", "updatedAt") SELECT "accountId", "amount", "createdAt", "createdById", "date", "description", "id", "method", "note", "payee", "receiptUrl", "updatedAt" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_churchId_date_idx" ON "Expense"("churchId", "date");
CREATE INDEX "Expense_accountId_idx" ON "Expense"("accountId");
CREATE TABLE "new_HistoryEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "dateIsApprox" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "content" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "churchId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HistoryEvent_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_HistoryEvent" ("category", "content", "createdAt", "date", "dateIsApprox", "id", "pinned", "title", "updatedAt") SELECT "category", "content", "createdAt", "date", "dateIsApprox", "id", "pinned", "title", "updatedAt" FROM "HistoryEvent";
DROP TABLE "HistoryEvent";
ALTER TABLE "new_HistoryEvent" RENAME TO "HistoryEvent";
CREATE INDEX "HistoryEvent_churchId_date_idx" ON "HistoryEvent"("churchId", "date");
CREATE INDEX "HistoryEvent_churchId_category_idx" ON "HistoryEvent"("churchId", "category");
CREATE TABLE "new_HistoryPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "takenAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "churchId" TEXT NOT NULL,
    "eventId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistoryPhoto_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HistoryPhoto_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoryEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HistoryPhoto" ("caption", "createdAt", "eventId", "id", "sortOrder", "takenAt", "url") SELECT "caption", "createdAt", "eventId", "id", "sortOrder", "takenAt", "url" FROM "HistoryPhoto";
DROP TABLE "HistoryPhoto";
ALTER TABLE "new_HistoryPhoto" RENAME TO "HistoryPhoto";
CREATE INDEX "HistoryPhoto_eventId_idx" ON "HistoryPhoto"("eventId");
CREATE INDEX "HistoryPhoto_churchId_idx" ON "HistoryPhoto"("churchId");
CREATE TABLE "new_Household" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "postalCode" TEXT,
    "address" TEXT,
    "addressDetail" TEXT,
    "phone" TEXT,
    "note" TEXT,
    "churchId" TEXT NOT NULL,
    "districtId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Household_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Household_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Household" ("address", "addressDetail", "createdAt", "districtId", "id", "name", "note", "phone", "postalCode", "updatedAt") SELECT "address", "addressDetail", "createdAt", "districtId", "id", "name", "note", "phone", "postalCode", "updatedAt" FROM "Household";
DROP TABLE "Household";
ALTER TABLE "new_Household" RENAME TO "Household";
CREATE INDEX "Household_churchId_idx" ON "Household"("churchId");
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameHanja" TEXT,
    "photoUrl" TEXT,
    "gender" TEXT,
    "birthDate" DATETIME,
    "birthIsLunar" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "email" TEXT,
    "postalCode" TEXT,
    "address" TEXT,
    "addressDetail" TEXT,
    "churchId" TEXT NOT NULL,
    "householdId" TEXT,
    "householdRel" TEXT,
    "districtId" TEXT,
    "position" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "registeredAt" DATETIME,
    "catechumenAt" DATETIME,
    "baptizedAt" DATETIME,
    "confirmedAt" DATETIME,
    "transferredAt" DATETIME,
    "transferTo" TEXT,
    "deceasedAt" DATETIME,
    "job" TEXT,
    "previousChurch" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Member_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Member_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Member_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Member" ("address", "addressDetail", "baptizedAt", "birthDate", "birthIsLunar", "catechumenAt", "code", "confirmedAt", "createdAt", "deceasedAt", "districtId", "email", "gender", "householdId", "householdRel", "id", "job", "name", "nameHanja", "note", "phone", "photoUrl", "position", "postalCode", "previousChurch", "registeredAt", "status", "transferTo", "transferredAt", "updatedAt") SELECT "address", "addressDetail", "baptizedAt", "birthDate", "birthIsLunar", "catechumenAt", "code", "confirmedAt", "createdAt", "deceasedAt", "districtId", "email", "gender", "householdId", "householdRel", "id", "job", "name", "nameHanja", "note", "phone", "photoUrl", "position", "postalCode", "previousChurch", "registeredAt", "status", "transferTo", "transferredAt", "updatedAt" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE INDEX "Member_churchId_name_idx" ON "Member"("churchId", "name");
CREATE INDEX "Member_churchId_status_idx" ON "Member"("churchId", "status");
CREATE INDEX "Member_householdId_idx" ON "Member"("householdId");
CREATE UNIQUE INDEX "Member_churchId_code_key" ON "Member"("churchId", "code");
CREATE TABLE "new_Offering" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "churchId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "memberId" TEXT,
    "donorName" TEXT,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Offering_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Offering_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Offering_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Offering_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Offering" ("accountId", "amount", "createdAt", "createdById", "date", "donorName", "id", "memberId", "method", "note", "updatedAt") SELECT "accountId", "amount", "createdAt", "createdById", "date", "donorName", "id", "memberId", "method", "note", "updatedAt" FROM "Offering";
DROP TABLE "Offering";
ALTER TABLE "new_Offering" RENAME TO "Offering";
CREATE INDEX "Offering_churchId_date_idx" ON "Offering"("churchId", "date");
CREATE INDEX "Offering_memberId_idx" ON "Offering"("memberId");
CREATE INDEX "Offering_accountId_idx" ON "Offering"("accountId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loginId" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "mustChangePw" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" DATETIME,
    "churchId" TEXT NOT NULL,
    "memberId" TEXT,
    "approvedAt" DATETIME,
    "approvedById" TEXT,
    "rejectReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "id", "lastLoginAt", "loginId", "memberId", "mustChangePw", "name", "password", "role", "updatedAt") SELECT "createdAt", "id", "lastLoginAt", "loginId", "memberId", "mustChangePw", "name", "password", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_loginId_key" ON "User"("loginId");
CREATE UNIQUE INDEX "User_memberId_key" ON "User"("memberId");
CREATE INDEX "User_churchId_status_idx" ON "User"("churchId", "status");
CREATE INDEX "User_churchId_role_idx" ON "User"("churchId", "role");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Church_name_idx" ON "Church"("name");
