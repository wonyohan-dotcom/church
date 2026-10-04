-- 성도 화면에 교회 잔액을 보여 줄지 (교회가 직접 켠다). 기존 교회는 지금까지의 화면과 맞추기 위해 켜 둔다.
ALTER TABLE "Church" ADD COLUMN "showBalanceToMembers" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Church" SET "showBalanceToMembers" = true;
