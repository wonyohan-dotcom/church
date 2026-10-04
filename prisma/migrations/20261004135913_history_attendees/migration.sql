-- AlterTable
ALTER TABLE "HistoryEvent" ADD COLUMN     "guests" TEXT;

-- CreateTable
CREATE TABLE "HistoryAttendee" (
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "HistoryAttendee_pkey" PRIMARY KEY ("eventId","memberId")
);

-- AddForeignKey
ALTER TABLE "HistoryAttendee" ADD CONSTRAINT "HistoryAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "HistoryEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryAttendee" ADD CONSTRAINT "HistoryAttendee_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
