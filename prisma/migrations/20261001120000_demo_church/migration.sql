-- 체험용 교회 표시
ALTER TABLE "Church" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
