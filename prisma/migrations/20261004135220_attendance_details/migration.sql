-- CreateTable
CREATE TABLE "AttendanceAbsence" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "recordId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "AttendanceAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceVisitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "recordId" TEXT NOT NULL,

    CONSTRAINT "AttendanceVisitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceAbsence_recordId_memberId_key" ON "AttendanceAbsence"("recordId", "memberId");

-- CreateIndex
CREATE INDEX "AttendanceVisitor_recordId_idx" ON "AttendanceVisitor"("recordId");

-- AddForeignKey
ALTER TABLE "AttendanceAbsence" ADD CONSTRAINT "AttendanceAbsence_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAbsence" ADD CONSTRAINT "AttendanceAbsence_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceVisitor" ADD CONSTRAINT "AttendanceVisitor_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
