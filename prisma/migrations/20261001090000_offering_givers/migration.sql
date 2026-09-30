-- 함께 드린 헌금 (여러 교인)
ALTER TABLE "Offering" ADD COLUMN "giversConfirmed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "OfferingGiver" (
    "offeringId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "OfferingGiver_pkey" PRIMARY KEY ("offeringId","memberId")
);

CREATE INDEX "OfferingGiver_memberId_idx" ON "OfferingGiver"("memberId");

ALTER TABLE "OfferingGiver" ADD CONSTRAINT "OfferingGiver_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfferingGiver" ADD CONSTRAINT "OfferingGiver_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
