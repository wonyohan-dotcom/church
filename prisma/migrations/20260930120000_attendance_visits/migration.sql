-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "service" TEXT NOT NULL DEFAULT 'SUNDAY',
    "visitorCount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "churchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCheck" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "AttendanceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'VISIT',
    "content" TEXT NOT NULL,
    "prayer" TEXT,
    "churchId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceRecord_churchId_service_date_idx" ON "AttendanceRecord"("churchId", "service", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_churchId_date_service_key" ON "AttendanceRecord"("churchId", "date", "service");

-- CreateIndex
CREATE INDEX "AttendanceCheck_memberId_idx" ON "AttendanceCheck"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceCheck_recordId_memberId_key" ON "AttendanceCheck"("recordId", "memberId");

-- CreateIndex
CREATE INDEX "Visit_churchId_date_idx" ON "Visit"("churchId", "date");

-- CreateIndex
CREATE INDEX "Visit_memberId_date_idx" ON "Visit"("memberId", "date");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCheck" ADD CONSTRAINT "AttendanceCheck_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCheck" ADD CONSTRAINT "AttendanceCheck_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

